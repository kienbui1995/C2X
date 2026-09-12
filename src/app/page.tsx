import { StudioClient } from "@/components/studio-client";
import { getDoctorStatus } from "@/lib/server-data";

export default async function HomePage() {
  const doctor = await getDoctorStatus();
  return <StudioClient doctor={doctor} />;
}
