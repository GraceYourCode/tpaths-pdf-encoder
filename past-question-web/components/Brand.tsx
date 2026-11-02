import Image from "next/image";
import Link from "next/link";

export default function Brand() {
  return (
    <Link href="/" className="flex items-center gap2">
      <Image src="/tpaths-logo.svg" alt="TPaths Logo" width={28} height={28} />
      <span className="brand text-brand">TPATHS</span>
    </Link>
  );
}
