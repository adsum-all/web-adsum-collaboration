import { useMarque } from "../../useMarque.js";

/**
 * Who signs an information, and the shortcuts offered for it.
 *
 * Extracted from the editor, which had grown past the size this project allows. It
 * is a self-contained piece: one value and a row of suggestions.
 *
 * The organisation names itself. These shortcuts used to be six literals naming one
 * organisation's roles, so a parish was offered "Le Berger des Missions" to sign its
 * announcements. What remains names nobody in particular; anything else is typed,
 * which is what the field is for.
 */
export function InformationSignature({
  signature,
  signatureUrl,
  monNom,
  editable,
  onChange,
}: Readonly<{
  signature: string;
  signatureUrl: string;
  /** The signed-in collaborator's own name, offered as a shortcut when known. */
  monNom: string;
  editable: boolean;
  onChange: (champ: "signature" | "signature_url", valeur: string) => void;
}>): JSX.Element {
  const marque = useMarque();

  return (
    <>
      <div className="field">
        <span>Signature (facultative)</span>
        <input
          value={signature}
          onChange={(e) => onChange("signature", e.target.value)}
          maxLength={200}
          disabled={!editable}
          placeholder={`Ex : ${marque.organisation}`}
        />
        {editable && (
          <div className="info-auteur-btns">
            <button type="button" className="btn btn-ghost btn-inline" onClick={() => onChange("signature", marque.organisation)}>
              {marque.organisation}
            </button>
            <button type="button" className="btn btn-ghost btn-inline" onClick={() => onChange("signature", "L'Administration")}>
              L&apos;Administration
            </button>
            {monNom && (
              <button type="button" className="btn btn-ghost btn-inline" onClick={() => onChange("signature", monNom)}>
                Mon nom
              </button>
            )}
          </div>
        )}
      </div>
      <label className="field">
        <span>Lien de signature (site officiel, facultatif)</span>
        <input
          value={signatureUrl}
          onChange={(e) => onChange("signature_url", e.target.value)}
          placeholder={marque.site ?? "https://exemple.org"}
          disabled={!editable}
        />
      </label>
    </>
  );
}
