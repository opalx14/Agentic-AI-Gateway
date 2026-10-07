"use client";

import Image from "next/image";
import Link from "next/link";

import { HeaderLanguageControl } from "@/components/HeaderLanguageControl";
import { HeaderWalletChooser } from "@/components/HeaderWalletChooser";
import { useAppLanguage } from "@/components/i18n/AppLanguageProvider";

export function SiteHeader() {
  const { language } = useAppLanguage();
  const links =
    language === "vi"
      ? [
          { href: "/", label: "Du lịch" },
          { href: "/product", label: "Luồng sản phẩm" },
        ]
      : [
          { href: "/", label: "Travel" },
          { href: "/product", label: "Product Flow" },
        ];

  return (
    <header className="landing-nav-wrap site-global-nav">
      <nav className="landing-nav-island" aria-label="Primary navigation">
        <Link href="/" className="landing-nav-brand" aria-label="Agentic AI Gateway home">
          <span className="landing-nav-mark">
            <Image src="/agentic-mark.svg" alt="" width={42} height={42} priority />
          </span>
          <span>
            <strong>Agentic AI Gateway</strong>
            <small>
              {language === "vi"
                ? "Quyền hành động + bằng chứng"
                : "Action authority + proof"}
            </small>
          </span>
        </Link>

        <div className="landing-nav-links">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className="landing-nav-runtime">
          <div className="landing-network-chip" title="Public network target">
            <i />
            <span>Solana Devnet</span>
          </div>
          <HeaderLanguageControl />
          <div className="landing-wallet">
            <HeaderWalletChooser />
          </div>
        </div>
      </nav>
    </header>
  );
}
