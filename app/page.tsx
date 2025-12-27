"use client";
import Segmento from "./components/segmento";
import { redirect } from "next/navigation";

// si caemos en esta ruta / redirigir a /segments
redirect('/segments');

export default function Home() {
  return (
    <Segmento />
  );
}
