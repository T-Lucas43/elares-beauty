"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Share, PlusSquare, X } from "lucide-react";
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
let savedPrompt: InstallPrompt | undefined;
export default function InstallAppButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | undefined>(savedPrompt);
  const [installed, setInstalled] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [ios, setIOS] = useState(false);
  useEffect(() => {
    setInstalled(matchMedia("(display-mode: standalone)").matches);
    setIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const capture = (event: Event) => {
      event.preventDefault();
      savedPrompt = event as InstallPrompt;
      setPrompt(savedPrompt);
    };
    const done = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", done);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  if (installed) return null;
  return (
    <>
      <button
        type="button"
        className="install-app-button"
        aria-label="Instalar aplicativo"
        onClick={async () => {
          if (prompt) {
            await prompt.prompt();
            const choice = await prompt.userChoice;
            if (choice.outcome === "accepted") setInstalled(true);
            setPrompt(undefined);
            savedPrompt = undefined;
          } else dialog.current?.showModal();
        }}
      >
        <Download size={17} />
        <span>Instalar app</span>
      </button>
      <dialog ref={dialog} className="install-dialog">
        <button
          type="button"
          className="icon-button dialog-close"
          aria-label="Fechar instruções de instalação"
          onClick={() => dialog.current?.close()}
        >
          <X size={20} />
        </button>
        <span className="eyebrow">NAVALHA NO SEU DIA A DIA</span>
        <h2>Suo salão na tela inicial.</h2>
        <p>
          Instale o aplicativo para abrir a agenda com um toque, sem precisar
          procurar a aba do navegador.
        </p>
        {ios ? (
          <ol>
            <li>Abra este endereço no Safari.</li>
            <li>
              Toque em <Share size={15} /> Compartilhar.
            </li>
            <li>
              Escolha <PlusSquare size={15} /> Adicionar à Tela de Início.
            </li>
          </ol>
        ) : (
          <ol>
            <li>Abra o sistema no Chrome ou Edge.</li>
            <li>
              No menu do navegador, escolha “Instalar Elares Beauty” ou
              “Adicionar à tela inicial”.
            </li>
            <li>Confirme a instalação no seu aparelho.</li>
          </ol>
        )}
        <small>
          A consulta da agenda e o registro de alterações precisam de conexão.
          No navegador integrado, abra o endereço no navegador do aparelho para
          instalar.
        </small>
        <button
          type="button"
          className="primary wide"
          onClick={() => dialog.current?.close()}
        >
          Entendi
        </button>
      </dialog>
    </>
  );
}
