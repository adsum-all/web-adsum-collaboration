import { useEffect, useMemo, useState } from "react";

import {
  deleteModelePerso,
  listModelesCatalogue,
  listModelesPerso,
  type ModeleCatalogue,
  type ModeleColonne,
  type ModelePerso,
} from "../../lib/store.js";
import { BibliothequeModeles } from "./BibliothequeModeles.js";
import { ModeleBuilder, brouillonVierge, type ModeleDraft } from "./ModeleBuilder.js";
import { ModelePreview } from "./ModelePreview.js";

interface ApercuModele {
  libelle: string;
  description?: string;
  source?: "systeme" | "personnalise";
  visibilite?: "partage" | "prive";
  colonnes: ModeleColonne[];
}

// The global template library page. Custom templates are NOT tied to a workspace: once
// created they are available in every workspace, next to the built-in catalogue. This
// page (gated by collaboration.modeles) is where they are built and managed; using one
// happens from a workspace's board-creation picker.
export function ModelesPage({ moiId }: Readonly<{ moiId: string }>): JSX.Element {
  const [catalogue, setCatalogue] = useState<ModeleCatalogue[]>([]);
  const [perso, setPerso] = useState<ModelePerso[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tab, setTab] = useState<"bibliotheque" | "creer">("bibliotheque");
  const [builderInit, setBuilderInit] = useState<ModeleDraft>(() => brouillonVierge());
  const [builderKey, setBuilderKey] = useState(0);
  const [apercu, setApercu] = useState<ApercuModele | null>(null);

  const standards = useMemo(() => catalogue.filter((m) => m.source !== "personnalise"), [catalogue]);

  async function recharger(): Promise<void> {
    setChargement(true);
    try {
      const [cat, list] = await Promise.all([listModelesCatalogue(), listModelesPerso()]);
      setCatalogue(cat);
      setPerso(list);
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Chargement impossible");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    void recharger();
  }, []);

  function ouvrirBuilder(init: ModeleDraft): void {
    setBuilderInit(init);
    setBuilderKey((k) => k + 1);
    setTab("creer");
  }

  function nouveau(): void {
    ouvrirBuilder(brouillonVierge());
  }

  function dupliquer(src: { libelle: string; description: string; colonnes: ModeleColonne[] }): void {
    ouvrirBuilder({
      id: null,
      nom: `${src.libelle} (copie)`,
      description: src.description,
      visibilite: "partage",
      colonnes: src.colonnes.map((c) => ({ nom: c.nom, couleur: c.couleur, wip: c.wip })),
    });
  }

  function editer(m: ModelePerso): void {
    ouvrirBuilder({
      id: m.id,
      nom: m.libelle,
      description: m.description,
      visibilite: m.visibilite,
      colonnes: m.colonnes.map((c) => ({ nom: c.nom, couleur: c.couleur, wip: c.wip })),
    });
  }

  async function supprimer(m: ModelePerso): Promise<void> {
    if (typeof window !== "undefined" && !window.confirm(`Supprimer le modèle « ${m.libelle} » ? Les tableaux déjà créés à partir de ce modèle ne sont pas affectés.`)) return;
    try {
      await deleteModelePerso(m.id);
      await recharger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Suppression impossible");
    }
  }

  return (
    <div className="page modeles-page">
      <header className="modeles-intro">
        <h1>Modèles de tableaux</h1>
        <p>
          Concevez des modèles réutilisables pour lancer un tableau en un clic. Un modèle n'est pas
          rattaché à un espace : une fois créé, il est disponible dans tous les espaces de travail et
          pour tous les collaborateurs, aux côtés des modèles standards. Chacun reste libre de
          l'utiliser ou non, et d'ajuster son tableau ensuite.
        </p>
      </header>

      {erreur && <div className="banner banner-error" role="alert">{erreur}</div>}

      <div className="modeles-onglets" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "bibliotheque"}
          className={`modeles-onglet${tab === "bibliotheque" ? " is-on" : ""}`} onClick={() => setTab("bibliotheque")}>
          Bibliothèque
        </button>
        <button type="button" role="tab" aria-selected={tab === "creer"}
          className={`modeles-onglet${tab === "creer" ? " is-on" : ""}`} onClick={nouveau}>
          Créer un modèle
        </button>
      </div>

      {tab === "bibliotheque" ? (
        <BibliothequeModeles
          perso={perso}
          standards={standards}
          moiId={moiId}
          chargement={chargement}
          onNouveau={nouveau}
          onApercu={setApercu}
          onDupliquer={dupliquer}
          onEditer={editer}
          onSupprimer={(m) => void supprimer(m)}
        />
      ) : (
        <ModeleBuilder
          key={builderKey}
          initial={builderInit}
          onSaved={() => void recharger()}
          onCancel={() => setTab("bibliotheque")}
        />
      )}

      {apercu && <ModelePreview modele={apercu} onClose={() => setApercu(null)} />}
    </div>
  );
}
