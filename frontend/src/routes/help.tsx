import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layout/public-layout";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { brand } from "@/config/brand";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/help")({
  head: () => seo("Ayuda", "Preguntas frecuentes."),
  component: Help,
});
const faqs: [string, string][] = [
  [
    "¿Necesito GPS para guardar mi estacionamiento?",
    "No. Puedes registrar edificio, nivel, fila y plaza manualmente.",
  ],
  [
    "¿Por qué no veo mi posición dentro del edificio?",
    "Los navegadores no pueden ubicarte con exactitud bajo techo. Usa el modo básico o el plano del edificio si está disponible.",
  ],
  [
    "¿Hay realidad aumentada?",
    "La vista AR estará disponible en la app nativa (ARKit/ARCore). En la web no se usa la cámara.",
  ],
  [
    "¿Cómo comparto mi vehículo?",
    "En Compartir, invita a una persona por correo y elige sus permisos.",
  ],
  [
    "¿Puedo eliminar mis datos?",
    "Sí, desde Privacidad puedes exportarlos o solicitar su eliminación.",
  ],
];
function Help() {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-bold">Ayuda</h1>
        <Accordion type="single" collapsible className="surface-card mt-8 px-6">
          {faqs.map(([q, a]) => (
            <AccordionItem key={q} value={q}>
              <AccordionTrigger>{q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="mt-6 text-sm text-muted-foreground">
          ¿Más dudas? Escríbenos a {brand.supportEmail} o abre un caso desde{" "}
          <Link to="/app/support" className="text-primary underline">
            Soporte
          </Link>
          .
        </p>
      </div>
    </PublicLayout>
  );
}
