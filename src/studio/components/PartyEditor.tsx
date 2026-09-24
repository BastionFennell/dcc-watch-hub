/**
 * The Episode tab (010, T1026, FR-1011).
 *
 * Two halves. The meta fields are the `show.json` row being built - title,
 * video, floor, duration - and the duration has a button that takes whatever
 * the player knows, which is the only number the author cannot read off the
 * screen. Below them, the starting party.
 *
 * The party editor is deliberately a raw-JSON box per crawler rather than a
 * sheet form: the crawler schema is large, the Studio's scope is events, and an
 * escape hatch that accepts exactly what the file carries can never be behind
 * the schema (spec Non-goals: "a full crawler-sheet form"). It validates before
 * it applies, and every apply goes through the history reducer, so undo covers
 * the party exactly as it covers events.
 *
 * Meta fields commit on blur, not per keystroke: one undo step per edit rather
 * than one per letter.
 */
import { useEffect, useState } from 'react';
import type { Crawler } from '../../data/types';
import { parseYouTubeId } from '../../playback/youtubeId';
import { studioCopy } from '../copy';
import type { StudioDraft } from '../draft';
import { draftParty } from '../draft';
import type { DraftAction } from '../history';
import { formatTimecode, parseTimecode } from '../timecode';
import styles from './PartyEditor.module.css';

export interface PartyEditorProps {
  draft: StudioDraft;
  dispatch(action: DraftAction): void;
  /** The player's own duration, when it knows one (FR-1001). */
  playerDuration: number | null;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function nameOf(raw: unknown, index: number): string {
  if (isRecord(raw) && typeof raw.name === 'string' && raw.name !== '') return raw.name;
  if (isRecord(raw) && typeof raw.id === 'string' && raw.id !== '') return raw.id;
  return `Crawler ${index + 1}`;
}

/** A sheet that `normalizeEpisode` accepts, for the author to fill in. */
function blankCrawler(index: number): Crawler {
  return {
    id: `crawler-${index + 1}`,
    name: 'New crawler',
    handle: '',
    player: '',
    level: 1,
    hp: { current: 10, max: 10 },
    portrait: '',
    class: null,
    inventory: [],
    rank: null,
  };
}

/* ------------------------------------------------------------ meta fields */

interface MetaFieldProps {
  label: string;
  testId: string;
  value: string;
  help?: string;
  error?: string | null;
  onCommit(value: string): void;
  children?: React.ReactNode;
}

function MetaField({ label, testId, value, help, error, onCommit, children }: MetaFieldProps) {
  const [text, setText] = useState(value);
  // Undo, redo and an import all change the draft under the field.
  useEffect(() => setText(value), [value]);

  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={testId}>
        {label}
      </label>
      <div className={styles.fieldRow}>
        <input
          id={testId}
          className={styles.input}
          data-testid={testId}
          type="text"
          value={text}
          aria-invalid={error == null ? undefined : true}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => onCommit(text)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onCommit(text);
            }
          }}
        />
        {children}
      </div>
      {error == null ? (
        help === undefined ? null : (
          <p className={styles.help}>{help}</p>
        )
      ) : (
        <p className={styles.error}>{error}</p>
      )}
    </div>
  );
}

/* --------------------------------------------------------- one crawler box */

interface CrawlerBoxProps {
  raw: unknown;
  index: number;
  onApply(index: number, value: unknown): void;
  onRemove(index: number): void;
}

function CrawlerBox({ raw, index, onApply, onRemove }: CrawlerBoxProps) {
  const serialized = JSON.stringify(raw, null, 2);
  const [text, setText] = useState(serialized);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    setText(serialized);
    setStatus(null);
  }, [serialized]);

  const name = nameOf(raw, index);

  function apply(): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch (cause) {
      setStatus(
        studioCopy.episode.jsonInvalid(cause instanceof Error ? cause.message : String(cause)),
      );
      return;
    }
    if (!isRecord(parsed)) {
      setStatus(studioCopy.episode.jsonNotObject);
      return;
    }
    if (typeof parsed.id !== 'string' || parsed.id === '') {
      setStatus(studioCopy.episode.jsonNoId);
      return;
    }
    setStatus(studioCopy.episode.jsonApplied);
    onApply(index, parsed);
  }

  const dirty = text !== serialized;

  return (
    <li className={styles.crawler} data-testid="crawler-box">
      <div className={styles.crawlerHead}>
        <h4 className={styles.crawlerName}>{name}</h4>
        <button
          type="button"
          className={styles.ghost}
          data-testid="remove-crawler"
          aria-label={studioCopy.episode.removeCrawlerLabel(name)}
          onClick={() => onRemove(index)}
        >
          {studioCopy.episode.removeCrawler}
        </button>
      </div>
      <textarea
        className={styles.json}
        data-testid="crawler-json"
        aria-label={studioCopy.episode.crawlerJsonLabel(name)}
        rows={10}
        spellCheck={false}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className={styles.crawlerActions}>
        <button
          type="button"
          className={styles.ghost}
          data-testid="crawler-apply"
          disabled={!dirty}
          onClick={apply}
        >
          {studioCopy.episode.apply}
        </button>
        <button
          type="button"
          className={styles.ghost}
          data-testid="crawler-reset"
          disabled={!dirty}
          onClick={() => {
            setText(serialized);
            setStatus(null);
          }}
        >
          {studioCopy.episode.reset}
        </button>
        {status === null ? null : (
          <p className={styles.status} data-testid="crawler-status" role="status">
            {status}
          </p>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ panel */

export function PartyEditor({ draft, dispatch, playerDuration }: PartyEditorProps) {
  const party = draftParty(draft);
  const { meta } = draft;
  const videoId = meta.youtubeId === '' ? null : parseYouTubeId(meta.youtubeId);

  function setParty(next: unknown[]): void {
    dispatch({ kind: 'setParty', party: next });
  }

  return (
    <div className={styles.wrap} data-testid="party-editor">
      <section className={styles.block}>
        <h3 className={styles.heading}>{studioCopy.episode.metaTitle}</h3>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>{studioCopy.episode.number}</span>
          <p className={styles.fixed} data-testid="episode-number">
            {meta.id}
          </p>
          <p className={styles.help}>{studioCopy.episode.numberHelp}</p>
        </div>

        <MetaField
          label={studioCopy.episode.episodeTitle}
          testId="meta-title"
          value={meta.title}
          onCommit={(value) => dispatch({ kind: 'setMeta', meta: { title: value } })}
        />

        <MetaField
          label={studioCopy.episode.youtube}
          testId="meta-youtube"
          value={meta.youtubeId}
          help={videoId === null ? undefined : studioCopy.episode.youtubeOk(videoId)}
          error={meta.youtubeId !== '' && videoId === null ? studioCopy.episode.youtubeInvalid : null}
          onCommit={(value) => {
            // The author may paste a whole watch URL; only the id is stored.
            const parsed = parseYouTubeId(value);
            dispatch({ kind: 'setMeta', meta: { youtubeId: parsed ?? value.trim() } });
          }}
        />

        <MetaField
          label={studioCopy.episode.floor}
          testId="meta-floor"
          value={String(meta.floor)}
          onCommit={(value) => {
            const floor = Number(value.trim());
            if (Number.isFinite(floor)) dispatch({ kind: 'setMeta', meta: { floor } });
          }}
        />

        <MetaField
          label={studioCopy.episode.duration}
          testId="meta-duration"
          value={meta.durationSec > 0 ? formatTimecode(meta.durationSec) : ''}
          help={studioCopy.episode.durationHelp}
          onCommit={(value) => {
            const seconds = value.trim() === '' ? 0 : parseTimecode(value);
            if (seconds !== null) {
              dispatch({ kind: 'setMeta', meta: { durationSec: Math.round(seconds) } });
            }
          }}
        >
          {playerDuration === null ? null : (
            <button
              type="button"
              className={styles.ghost}
              data-testid="use-player-duration"
              aria-label={studioCopy.episode.usePlayerDurationLabel(formatTimecode(playerDuration))}
              onClick={() =>
                dispatch({ kind: 'setMeta', meta: { durationSec: Math.round(playerDuration) } })
              }
            >
              {studioCopy.episode.usePlayerDuration}
            </button>
          )}
        </MetaField>
      </section>

      <section className={styles.block}>
        <div className={styles.partyHead}>
          <h3 className={styles.heading}>{studioCopy.episode.partyTitle}</h3>
          <button
            type="button"
            className={styles.ghost}
            data-testid="add-crawler"
            onClick={() => setParty([...party, blankCrawler(party.length)])}
          >
            {studioCopy.episode.addCrawler}
          </button>
        </div>
        <p className={styles.help}>{studioCopy.episode.jsonHelp}</p>

        {party.length === 0 ? (
          <p className={styles.empty} data-testid="party-empty">
            {studioCopy.episode.partyEmpty}
          </p>
        ) : (
          <ul className={styles.crawlers}>
            {party.map((raw, index) => (
              <CrawlerBox
                key={isRecord(raw) && typeof raw.id === 'string' ? raw.id : index}
                raw={raw}
                index={index}
                onApply={(at, value) => {
                  const next = party.slice();
                  next[at] = value;
                  setParty(next);
                }}
                onRemove={(at) => {
                  if (!window.confirm(studioCopy.episode.removeCrawlerConfirm(nameOf(party[at], at))))
                    return;
                  setParty(party.filter((_, i) => i !== at));
                }}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default PartyEditor;
