"use client";

import { useEffect } from "react";

export default function DocsPage() {
  useEffect(() => {
    // Insertar dinámicamente los estilos oficiales de Swagger
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css";
    document.head.appendChild(link);

    // Insertar el script de Swagger
    const script = document.createElement("script");
    script.src = "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js";
    script.async = true;
    script.onload = () => {
      // Una vez cargado el script, inicializamos Swagger apuntando a tu openapi.json
      if ((window as any).SwaggerUIBundle) {
        (window as any).SwaggerUIBundle({
          url: "/openapi.json",
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [
            (window as any).SwaggerUIBundle.presets.apis,
            (window as any).SwaggerUIBundle.SwaggerUIStandalonePreset
          ],
        });
      }
    };
    document.body.appendChild(script);

    // Limpieza al desmontar el componente
    return () => {
      link.remove();
      script.remove();
    };
  }, []);

  return (
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
      {/* Contenedor HTML puro donde se montará la documentación */}
      <div id="swagger-ui"></div>
    </div>
  );
}
