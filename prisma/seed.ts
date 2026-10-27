import "dotenv/config";
import { createHash } from "crypto";
import { deflateSync } from "zlib";
import { PrismaClient, type GlobalRole, type User } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

// Mot de passe de dev de tous les comptes (docs/testing-auth.md)
const DEV_PASSWORD = "motdepasse123";

// ── Fichiers factices ────────────────────────────────────────────────────────
// De petits fichiers réels (pas juste des octets magiques) : un minuscule PDF
// et un minuscule PNG, générés ici plutôt que stockés comme fixtures binaires.

function sha256Hex(buffer: Buffer): string {
    return createHash("sha256").update(buffer).digest("hex");
}

// CRC32 standard (table IEEE 802.3), nécessaire pour des chunks PNG valides.
function crc32(buffer: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) {
            crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeBuffer = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
    return Buffer.concat([length, typeBuffer, data, crc]);
}

// Un petit PNG RGB valide, uni, de `size` x `size` pixels.
function tinyPng(size: number, rgb: [number, number, number]): Buffer {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(size, 0);
    ihdrData.writeUInt32BE(size, 4);
    ihdrData[8] = 8; // bit depth
    ihdrData[9] = 2; // color type: RGB
    ihdrData[10] = 0; // compression
    ihdrData[11] = 0; // filter
    ihdrData[12] = 0; // interlace

    const rowLength = 1 + size * 3; // un octet de filtre "none" par ligne
    const raw = Buffer.alloc(size * rowLength);
    for (let y = 0; y < size; y++) {
        const rowStart = y * rowLength;
        raw[rowStart] = 0;
        for (let x = 0; x < size; x++) {
            const pixelStart = rowStart + 1 + x * 3;
            raw[pixelStart] = rgb[0];
            raw[pixelStart + 1] = rgb[1];
            raw[pixelStart + 2] = rgb[2];
        }
    }

    return Buffer.concat([
        signature,
        pngChunk("IHDR", ihdrData),
        pngChunk("IDAT", deflateSync(raw)),
        pngChunk("IEND", Buffer.alloc(0)),
    ]);
}

// Un petit PDF à une page, valide (table xref à jour), portant quelques lignes de texte.
function tinyPdf(lines: string[]): Buffer {
    const escape = (s: string) => s.replace(/([()\\])/g, "\\$1");

    let streamText = "BT /F1 12 Tf 20 160 Td\n";
    for (const line of lines) {
        streamText += `(${escape(line)}) Tj 0 -16 Td\n`;
    }
    streamText += "ET";
    const streamLength = Buffer.byteLength(streamText, "latin1");

    const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 240 200] /Contents 5 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        `<< /Length ${streamLength} >>\nstream\n${streamText}\nendstream`,
    ];

    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [];
    for (let i = 0; i < objects.length; i++) {
        offsets[i] = Buffer.byteLength(pdf, "latin1");
        pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, "latin1");
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) {
        pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, "latin1");
}

function daysFromNow(n: number): Date {
    return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

// ── Utilisateurs ─────────────────────────────────────────────────────────────

// email@mespapiers.test, dérivé du nom affiché : accents et espaces retirés, en
// minuscules. Le login met l'email saisi en minuscules avant de le chercher.
function slugify(name: string): string {
    return name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "");
}

async function createUser(displayName: string, globalRole: GlobalRole = "USER") {
    return prisma.user.create({
        data: {
            email: `${slugify(displayName)}@mespapiers.test`,
            displayName,
            passwordHash: await hashPassword(DEV_PASSWORD),
            globalRole,
        },
    });
}

// ── Documents ────────────────────────────────────────────────────────────────

type DocumentSpec = {
    owner: User;
    fileName: string;
    kind: "pdf" | "png";
    category: "IDENTITY" | "INSURANCE_AUTO" | "OTHER";
    extractionStatus: "PENDING" | "NEEDS_REVIEW" | "CONFIRMED" | "FAILED";
    deadlineType?: "HARD" | "SOFT" | "PERIODIC" | "NONE" | null;
    targetDate?: Date | null;
    identity?: { fullName: string; birthDate: Date; documentNumber: string; expiryDate: Date };
    insurance?: { provider: string; policyNumber: string; vehiclePlate: string; expiryDate: Date };
};

const CATEGORY_COLOR: Record<DocumentSpec["category"], [number, number, number]> = {
    IDENTITY: [37, 99, 235],
    INSURANCE_AUTO: [22, 163, 74],
    OTHER: [217, 119, 6],
};

async function createDocument(spec: DocumentSpec) {
    const buffer =
        spec.kind === "pdf"
            ? tinyPdf([spec.fileName, `${spec.owner.displayName} — ${spec.category}`])
            : tinyPng(8, CATEGORY_COLOR[spec.category]);
    const fileType = spec.kind === "pdf" ? "application/pdf" : "image/png";

    const document = await prisma.document.create({
        data: {
            ownerId: spec.owner.id,
            fileName: spec.fileName,
            fileType,
            fileSize: buffer.length,
            fileData: new Uint8Array(buffer),
            fileHash: sha256Hex(buffer),
            category: spec.category,
            extractionStatus: spec.extractionStatus,
            deadlineType: spec.deadlineType ?? null,
            targetDate: spec.targetDate ?? null,
        },
    });

    if (spec.identity) {
        await prisma.documentIdentity.create({ data: { documentId: document.id, ...spec.identity } });
    }
    if (spec.insurance) {
        await prisma.documentInsuranceAuto.create({ data: { documentId: document.id, ...spec.insurance } });
    }

    return document;
}

// ── Channels, réponses, invitations, demandes ───────────────────────────────

// Crée un channel avec son créateur (MODERATOR), ses membres (MEMBER, sauf les
// `moderators` listés qui sont promus), et sa question. `isPrivate` par défaut à false.
async function createChannel(
    creator: User,
    title: string,
    description: string,
    question: string,
    details: string,
    members: User[],
    opts: { moderators?: User[]; isPrivate?: boolean } = {}
) {
    const moderatorIds = new Set((opts.moderators ?? []).map((m) => m.id));

    const channel = await prisma.channel.create({
        data: { createdBy: creator.id, title, description, isPrivate: opts.isPrivate ?? false },
    });

    await prisma.channelMember.createMany({
        data: [
            { channelId: channel.id, userId: creator.id, role: "MODERATOR" },
            ...members.map((member) => ({
                channelId: channel.id,
                userId: member.id,
                role: moderatorIds.has(member.id) ? ("MODERATOR" as const) : ("MEMBER" as const),
            })),
        ],
    });

    const thread = await prisma.thread.create({
        data: { channelId: channel.id, userId: creator.id, title: question, content: details },
    });

    return { channel, thread };
}

async function addAnswer(thread: { id: number }, author: User, content: string) {
    return prisma.answer.create({ data: { threadId: thread.id, userId: author.id, content } });
}

async function addInvites(channelId: number, users: User[]) {
    if (users.length === 0) return;
    await prisma.channelInvite.createMany({ data: users.map((u) => ({ channelId, userId: u.id })) });
}

async function addJoinRequests(channelId: number, users: User[]) {
    if (users.length === 0) return;
    await prisma.channelJoinRequest.createMany({ data: users.map((u) => ({ channelId, userId: u.id })) });
}

async function main() {
    // 1. Utilisateurs : les dix d'origine, plus dix profils variés (France et étranger).
    const Amir = await createUser("Amir");
    const Adrien = await createUser("Adrien");
    const Rasiol = await createUser("Rasiol", "ADMIN");
    const Syu = await createUser("Syu");
    const Alexandre = await createUser("Alexandre");
    const Lina = await createUser("Lina");
    const Yanis = await createUser("Yanis");
    const Sarah = await createUser("Sarah");
    const Karim = await createUser("Karim");
    const Emma = await createUser("Emma");

    const Maria = await createUser("Maria Garcia");
    const John = await createUser("John Smith");
    const Wei = await createUser("Wei Chen");
    const Fatima = await createUser("Fatima Ben Ali");
    const Giulia = await createUser("Giulia Rossi");
    const Hans = await createUser("Hans Müller");
    const Olga = await createUser("Olga Ivanova");
    const Kwame = await createUser("Kwame Mensah");
    const Aiko = await createUser("Aiko Tanaka");
    const Liam = await createUser("Liam O'Connor");

    const users = [
        Amir, Adrien, Rasiol, Syu, Alexandre, Lina, Yanis, Sarah, Karim, Emma,
        Maria, John, Wei, Fatima, Giulia, Hans, Olga, Kwame, Aiko, Liam,
    ];

    // 2. Documents : certains utilisateurs en ont plusieurs, certains un seul,
    // certains aucun (Adrien, Alexandre, Yanis, Karim, Wei, Hans, Kwame, Liam).
    const documents = [
        await createDocument({
            owner: Amir,
            fileName: "carte_identite_amir.pdf",
            kind: "pdf",
            category: "IDENTITY",
            extractionStatus: "CONFIRMED",
            deadlineType: "HARD",
            targetDate: daysFromNow(400),
            identity: {
                fullName: "Amir",
                birthDate: new Date("1996-03-14T00:00:00Z"),
                documentNumber: "ID-884215",
                expiryDate: daysFromNow(400),
            },
        }),
        await createDocument({
            owner: Amir,
            fileName: "assurance_auto_maif.pdf",
            kind: "pdf",
            category: "INSURANCE_AUTO",
            extractionStatus: "CONFIRMED",
            deadlineType: "SOFT",
            targetDate: daysFromNow(18),
            insurance: {
                provider: "MAIF",
                policyNumber: "MAIF-2244110",
                vehiclePlate: "AB-123-CD",
                expiryDate: daysFromNow(18),
            },
        }),
        await createDocument({
            owner: Amir,
            fileName: "document_divers.pdf",
            kind: "pdf",
            category: "OTHER",
            extractionStatus: "NEEDS_REVIEW",
        }),

        await createDocument({
            owner: Rasiol,
            fileName: "carte_identite_rasiol.pdf",
            kind: "pdf",
            category: "IDENTITY",
            extractionStatus: "CONFIRMED",
            deadlineType: "HARD",
            targetDate: daysFromNow(-15),
            identity: {
                fullName: "Rasiol",
                birthDate: new Date("1994-07-02T00:00:00Z"),
                documentNumber: "ID-119004",
                expiryDate: daysFromNow(-15),
            },
        }),

        await createDocument({
            owner: Maria,
            fileName: "dni_maria.pdf",
            kind: "pdf",
            category: "IDENTITY",
            extractionStatus: "CONFIRMED",
            deadlineType: "HARD",
            targetDate: daysFromNow(-5),
            identity: {
                fullName: "Maria Garcia",
                birthDate: new Date("1990-11-20T00:00:00Z"),
                documentNumber: "DNI-7781234",
                expiryDate: daysFromNow(-5),
            },
        }),
        await createDocument({
            owner: Maria,
            fileName: "assurance_axa.pdf",
            kind: "pdf",
            category: "INSURANCE_AUTO",
            extractionStatus: "CONFIRMED",
            deadlineType: "SOFT",
            targetDate: daysFromNow(200),
            insurance: {
                provider: "AXA",
                policyNumber: "AXA-5509981",
                vehiclePlate: "CD-456-EF",
                expiryDate: daysFromNow(200),
            },
        }),

        await createDocument({
            owner: John,
            fileName: "scan_document.png",
            kind: "png",
            category: "OTHER",
            extractionStatus: "PENDING",
        }),

        await createDocument({
            owner: Giulia,
            fileName: "assurance_generali.pdf",
            kind: "pdf",
            category: "INSURANCE_AUTO",
            extractionStatus: "CONFIRMED",
            deadlineType: "SOFT",
            targetDate: daysFromNow(10),
            insurance: {
                provider: "Generali",
                policyNumber: "GEN-334221",
                vehiclePlate: "EF-789-GH",
                expiryDate: daysFromNow(10),
            },
        }),
        await createDocument({
            owner: Giulia,
            fileName: "diplome_giulia.pdf",
            kind: "pdf",
            category: "OTHER",
            extractionStatus: "CONFIRMED",
            deadlineType: "NONE",
        }),

        await createDocument({
            owner: Olga,
            fileName: "passeport_olga.pdf",
            kind: "pdf",
            category: "IDENTITY",
            extractionStatus: "NEEDS_REVIEW",
            deadlineType: "HARD",
            identity: {
                fullName: "Olga Ivanova",
                birthDate: new Date("1998-01-09T00:00:00Z"),
                documentNumber: "PASS-660214",
                expiryDate: daysFromNow(500),
            },
        }),

        await createDocument({
            owner: Aiko,
            fileName: "document_illisible.png",
            kind: "png",
            category: "OTHER",
            extractionStatus: "FAILED",
        }),

        await createDocument({
            owner: Syu,
            fileName: "assurance_allianz.pdf",
            kind: "pdf",
            category: "INSURANCE_AUTO",
            extractionStatus: "CONFIRMED",
            deadlineType: "SOFT",
            targetDate: daysFromNow(365),
            insurance: {
                provider: "Allianz",
                policyNumber: "ALZ-120984",
                vehiclePlate: "GH-012-IJ",
                expiryDate: daysFromNow(365),
            },
        }),

        await createDocument({
            owner: Sarah,
            fileName: "carte_identite_sarah.pdf",
            kind: "pdf",
            category: "IDENTITY",
            extractionStatus: "CONFIRMED",
            deadlineType: "HARD",
            targetDate: daysFromNow(90),
            identity: {
                fullName: "Sarah",
                birthDate: new Date("2000-05-30T00:00:00Z"),
                documentNumber: "ID-556231",
                expiryDate: daysFromNow(90),
            },
        }),

        await createDocument({
            owner: Emma,
            fileName: "attestation_emma.pdf",
            kind: "pdf",
            category: "OTHER",
            extractionStatus: "CONFIRMED",
            deadlineType: "NONE",
        }),

        await createDocument({
            owner: Fatima,
            fileName: "titre_sejour_fatima.pdf",
            kind: "pdf",
            category: "IDENTITY",
            extractionStatus: "CONFIRMED",
            deadlineType: "HARD",
            targetDate: daysFromNow(45),
            identity: {
                fullName: "Fatima Ben Ali",
                birthDate: new Date("1995-09-12T00:00:00Z"),
                documentNumber: "TS-902341",
                expiryDate: daysFromNow(45),
            },
        }),
        await createDocument({
            owner: Fatima,
            fileName: "notes_fatima.png",
            kind: "png",
            category: "OTHER",
            extractionStatus: "PENDING",
        }),
    ];

    // 3. Channels publics (chaque utilisateur est dans au moins un channel).
    const auto = await createChannel(
        Amir,
        "Assurance auto",
        "Questions sur l'assurance voiture",
        "Quels papiers pour assurer ma voiture ?",
        "Je viens d'acheter une voiture. L'assureur me demande la carte grise. C'est obligatoire ?",
        [Adrien, Lina, Karim, Maria, Giulia, Hans],
        { moderators: [Giulia] }
    );

    const sejour = await createChannel(
        Adrien,
        "Titre de séjour",
        "Demande et renouvellement du titre de séjour",
        "Quand renouveler mon titre de séjour ?",
        "Mon titre de séjour expire dans 3 mois. Quand dois-je faire la demande ?",
        [Rasiol, Yanis, Sarah, Wei, Fatima, Aiko, Liam],
        { moderators: [Fatima] }
    );

    const caf = await createChannel(
        Rasiol,
        "CAF",
        "Aides au logement et démarches CAF",
        "Comment déclarer un changement d'adresse à la CAF ?",
        "Je viens de déménager. Je dois prévenir la CAF en ligne ou par courrier ?",
        [Syu, Emma, Amir, Olga, Kwame, Maria],
        { moderators: [Olga] }
    );

    const identite = await createChannel(
        Syu,
        "Carte d'identité",
        "Faire ou refaire sa carte d'identité",
        "Carte d'identité perdue : que faire ?",
        "J'ai perdu ma carte d'identité. Je dois faire une déclaration de perte avant de la refaire ?",
        [Alexandre, Lina, John, Liam]
    );

    const impots = await createChannel(
        Alexandre,
        "Impôts",
        "Déclaration de revenus et impôts",
        "Je dois déclarer mes revenus en tant qu'étudiant ?",
        "C'est ma première année seul. Je dois faire une déclaration même si je gagne peu ?",
        [Karim, Emma, Yanis, Sarah, Hans, Giulia],
        { moderators: [Hans] }
    );

    const secuSociale = await createChannel(
        Maria,
        "Sécurité sociale",
        "Carte Vitale et affiliation à la sécurité sociale",
        "Comment obtenir ma carte Vitale ?",
        "Je viens d'arriver en France et je n'ai pas encore de numéro de sécurité sociale. Comment faire ma première demande ?",
        [Fatima, Wei, Olga, Kwame, Amir],
        { moderators: [Kwame] }
    );

    const permis = await createChannel(
        John,
        "Permis de conduire",
        "Validité et conversion du permis de conduire",
        "Mon permis étranger est-il valable en France ?",
        "J'ai un permis de conduire obtenu à l'étranger. Dois-je le faire reconnaître ou repasser l'examen ?",
        [Liam, Aiko, Karim, Lina],
        { moderators: [Liam] }
    );

    // 4. Réponses et votes (pour qu'aucune page de channel ne soit vide).
    const autoAnswer = await addAnswer(
        auto.thread,
        Adrien,
        "Oui, la carte grise est obligatoire pour assurer une voiture."
    );
    await addAnswer(
        auto.thread,
        Karim,
        "En attendant la carte grise, tu peux donner le certificat provisoire."
    );
    await prisma.vote.create({ data: { answerId: autoAnswer.id, userId: Lina.id, value: 1 } });

    await addAnswer(
        sejour.thread,
        Yanis,
        "Il faut déposer la demande de renouvellement 2 à 4 mois avant l'expiration, sur le site de l'ANEF."
    );
    await addAnswer(
        sejour.thread,
        Fatima,
        "Pense à prendre rendez-vous en préfecture dès que possible, les délais sont longs."
    );

    await addAnswer(
        caf.thread,
        Emma,
        "Tu peux déclarer ton changement d'adresse directement depuis ton espace CAF.fr, c'est plus rapide que par courrier."
    );

    await addAnswer(
        identite.thread,
        Alexandre,
        "Oui, il faut d'abord faire une déclaration de perte en ligne sur service-public.fr avant de refaire une demande."
    );

    const impotsAnswer = await addAnswer(
        impots.thread,
        Karim,
        "Oui, tu dois déclarer même avec de petits revenus, surtout si tu veux percevoir certaines aides ensuite."
    );
    await prisma.vote.create({ data: { answerId: impotsAnswer.id, userId: Sarah.id, value: 1 } });

    await addAnswer(
        secuSociale.thread,
        Olga,
        "Il faut remplir le formulaire S1106 et l'envoyer à ta CPAM avec une pièce d'identité et un justificatif de domicile."
    );

    await addAnswer(
        permis.thread,
        Aiko,
        "Ça dépend du pays d'origine : certains permis se convertissent directement, d'autres demandent de repasser l'examen en France."
    );

    // 5. Channels privés, avec invitations et demandes en attente.
    const entraide = await createChannel(
        Fatima,
        "Entraide expatriés",
        "Groupe d'entraide pour les démarches administratives des nouveaux arrivants",
        "Quelqu'un pour m'aider à remplir mon dossier de titre de séjour ?",
        "Je m'y perds un peu avec tous les documents demandés, est-ce que quelqu'un peut m'aider ici ?",
        [Wei, Olga],
        { isPrivate: true }
    );

    const voisins = await createChannel(
        Lina,
        "Voisins du quartier",
        "Entraide de voisinage : prêt d'outils, infos pratiques, bons plans du quartier",
        "Quelqu'un a une perceuse à prêter ce week-end ?",
        "Je dois monter un meuble et je n'ai pas d'outils, quelqu'un du quartier peut m'aider ?",
        [Sarah, Karim],
        { isPrivate: true }
    );

    // Invitations en attente (pas encore membres) : les quatre d'origine, plus
    // celles des deux channels privés.
    await addInvites(sejour.channel.id, [Amir]);
    await addInvites(impots.channel.id, [Amir]);
    await addInvites(auto.channel.id, [Sarah]);
    await addInvites(identite.channel.id, [Emma]);
    await addInvites(entraide.channel.id, [Hans, Kwame, Liam]);
    await addInvites(voisins.channel.id, [Amir, Emma]);

    // Demandes pour rejoindre en attente (pas encore acceptées).
    await addJoinRequests(entraide.channel.id, [John, Giulia]);
    await addJoinRequests(voisins.channel.id, [Syu, Yanis]);

    const publicChannels = 7;
    const privateChannels = 2;
    const invites = 4 + 3 + 2;
    const joinRequests = 2 + 2;

    console.log(
        `Seed terminé : ${users.length} utilisateurs (mot de passe "${DEV_PASSWORD}", rasiol@mespapiers.test est ADMIN), ` +
            `${documents.length} documents, ${publicChannels} channels publics, ${privateChannels} channels privés, ` +
            `${invites} invitations en attente, ${joinRequests} demandes pour rejoindre en attente`
    );
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
