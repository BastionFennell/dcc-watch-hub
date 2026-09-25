/**
 * The dossier's three-cell strip (012): level, condition, last on camera.
 *
 * It reports the cards the reader has opened and nothing else - `deriveStrip`
 * has already done that arithmetic - so a cell with no answer yet is not a dash
 * or a zero but a grey pill with no text in it at all. A dash would be a
 * statement ("nothing to report"); a pill is visibly a lid.
 *
 * Which is why the pill carries its own label: "Hidden" is what it is, and a
 * screen reader gets the same word a sighted reader gets from the grey.
 */
import type { StripValues } from '../../dossier/derive';
import { siteCopy } from '../../copy';
import styles from './DossierStrip.module.css';

export interface DossierStripProps {
  values: StripValues;
}

const { dossier } = siteCopy;

/** One cell. `value === null` is the lid, and it looks the same in all three. */
function Cell({ label, value }: { label: string; value: string | null }) {
  return (
    <div className={styles.cell}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>
        {value === null ? (
          /* `role="img"` so the label is exposed: `aria-label` on a bare span
             is ignored by browsers and flagged by axe. */
          <span className={styles.pill} role="img" aria-label={dossier.hiddenValue} />
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

export function DossierStrip({ values }: DossierStripProps) {
  const { level, condition, lastOnCamera } = values;

  return (
    <dl className={styles.strip} data-testid="dossier-strip">
      <Cell label={dossier.levelLabel} value={level === null ? null : String(level)} />
      <Cell
        label={dossier.conditionLabel}
        value={condition === null ? null : condition === 'deceased' ? dossier.deceased : dossier.alive}
      />
      <Cell
        label={dossier.lastOnCameraLabel}
        value={lastOnCamera === null ? null : dossier.lastOnCamera(lastOnCamera)}
      />
    </dl>
  );
}

export default DossierStrip;
