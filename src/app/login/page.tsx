"use client"; // nous permet de reagir a ce que le client fait directement

import { useState } from "react"; 
import { useRouter } from "next/navigation"; // renvoie lutilisateur vers une autre que lon definie

// declaration de la function login principal du fichier
export default function LoginPage()
{
    const [Email,setEmail] = useState("");
    const [PassWord,setPassWord] = useState("");
    const routeur  = useRouter()
    return
    {

    };
}

const documentsPage = () => {
}

