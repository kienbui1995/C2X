import { Suspense } from "react";
import { StudioClient } from "@/components/studio-client";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <StudioClient />
    </Suspense>
  );
}
