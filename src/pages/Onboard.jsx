import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Camera,
  Check,
  CheckCircle,
  CircleNotch,
  IdentificationCard,
  PaperPlaneTilt,
  Trash,
  UploadSimple,
  X,
} from '@phosphor-icons/react'
import { API_BASE } from '../lib/api'
import { cx } from '../lib/utils'
import { DUR, EASE_OUT, collapse, fadeUp, pop, spring } from '../lib/motion'
import { NobleMark } from '../components/logos'

/**
 * PUBLIC field-onboarding form — no login. New field hires (or their manager)
 * fill this on a phone; submissions land in a pending queue that HR reviews
 * inside the app. Photos post to the API and are stored outside the web root.
 * Branded Noble end-to-end (.portal-noble re-brands every accent-* token).
 */

const DESIGNATIONS = [
  { value: 'TM', label: 'TM — Territory Manager' },
  { value: 'ASM', label: 'ASM — Area Sales Manager' },
  { value: 'RSM', label: 'RSM — Regional Sales Manager' },
  { value: 'ZSM', label: 'ZSM — Zonal Sales Manager' },
]

const MAX_PHOTO_MB = 8

const inputCls =
  'w-full h-11 rounded-[10px] border border-hairline bg-surface-high px-3 text-[14px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 placeholder:text-ink-faint'

function Field({ label, required, children, hint }) {
  return (
    <label className="block">
      <span className="block text-[12.5px] font-semibold mb-1.5">
        {label} {required && <span className="text-rose-ink">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[11.5px] text-ink-faint mt-1">{hint}</span>}
    </label>
  )
}

/* ---------------- Live camera modal (getUserMedia) ---------------- */
function CameraModal({ title, onCapture, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not available in this browser — use Upload instead.')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().then(() => setReady(true)).catch(() => setReady(true))
        }
      })
      .catch(() => setError('Camera access was blocked — allow it, or use Upload instead.'))
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const snap = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d').drawImage(v, 0, 0)
    c.toBlob(
      (b) => {
        if (b) onCapture(new File([b], 'capture.jpg', { type: 'image/jpeg' }))
        onClose()
      },
      'image/jpeg',
      0.88,
    )
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: DUR.base } }}
      className="fixed inset-0 z-50 grid place-items-center bg-ink/70 px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: DUR.slow, ease: EASE_OUT } }}
        className="w-full max-w-lg bg-surface-high rounded-2xl shadow-pop overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
          <p className="text-[13.5px] font-semibold">{title}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg text-ink-faint hover:text-ink cursor-pointer" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="bg-ink aspect-[4/3] grid place-items-center">
          {error ? (
            <p className="text-[13px] text-white/80 px-8 text-center">{error}</p>
          ) : (
            <video ref={videoRef} playsInline muted className="w-full h-full object-contain" />
          )}
        </div>
        <div className="p-3 flex justify-center">
          <button
            onClick={snap}
            disabled={!!error || !ready}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-[10px] bg-accent enabled:hover:bg-accent-deep enabled:active:scale-95 disabled:opacity-50 text-white text-[13.5px] font-semibold transition-[background-color,transform] duration-[var(--dur-fast)] enabled:cursor-pointer"
          >
            <Camera size={16} weight="bold" /> Capture
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ------------- Photo side: one face of a document (upload or capture) ------------- */
function PhotoSide({ doc, side, file, onChange }) {
  const inputRef = useRef(null)
  const [camera, setCamera] = useState(false)
  const [preview, setPreview] = useState(null)
  const [err, setErr] = useState(null)
  const title = `${doc} — ${side.toLowerCase()}`

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const accept = (f) => {
    setErr(null)
    if (!f) return
    if (!f.type.startsWith('image/')) {
      setErr('Please choose an image file.')
      return
    }
    if (f.size > MAX_PHOTO_MB * 1024 * 1024) {
      setErr(`Too large (max ${MAX_PHOTO_MB} MB).`)
      return
    }
    onChange(f)
  }

  return (
    <div>
      <span className="block text-[11.5px] font-semibold text-ink-soft mb-1">{side}</span>
      <AnimatePresence mode="wait" initial={false}>
      {preview ? (
        <motion.div key="preview" {...pop} className="relative rounded-[10px] border border-mint/50 bg-surface-high overflow-hidden">
          <img src={preview} alt={title} className="h-24 w-full object-cover" />
          <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-md bg-mint text-white text-[10.5px] font-bold px-1.5 py-0.5">
            <Check size={10} weight="bold" /> Added
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-ink/60 text-white hover:bg-rose-ink transition-colors cursor-pointer"
            title="Remove"
          >
            <Trash size={14} />
          </button>
        </motion.div>
      ) : (
        <motion.div key="choose" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: DUR.base } }} exit={{ opacity: 0, transition: { duration: DUR.fast } }} className="grid gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="h-[46px] rounded-[10px] border-2 border-dashed border-hairline-strong hover:border-accent hover:bg-accent-soft/40 active:scale-[0.98] text-ink-soft flex items-center justify-center gap-1.5 text-[12px] font-semibold transition-[border-color,background-color,transform] duration-[var(--dur-fast)] cursor-pointer"
          >
            <UploadSimple size={15} /> Upload
          </button>
          <button
            type="button"
            onClick={() => setCamera(true)}
            className="h-[46px] rounded-[10px] border-2 border-dashed border-hairline-strong hover:border-accent hover:bg-accent-soft/40 active:scale-[0.98] text-ink-soft flex items-center justify-center gap-1.5 text-[12px] font-semibold transition-[border-color,background-color,transform] duration-[var(--dur-fast)] cursor-pointer"
          >
            <Camera size={15} /> Take photo
          </button>
        </motion.div>
      )}
      </AnimatePresence>

      {/* On phones the picker itself offers the camera too */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          accept(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <AnimatePresence initial={false}>
        {err && (
          <motion.p key="err" {...collapse} role="alert" className="overflow-hidden text-[11.5px] text-rose-ink">
            <span className="block pt-1">{err}</span>
          </motion.p>
        )}
      </AnimatePresence>
      {camera && <CameraModal title={title} onCapture={accept} onClose={() => setCamera(false)} />}
    </div>
  )
}

/* ------------- Document group: front + back of one card ------------- */
function DocPhotos({ doc, front, setFront, back, setBack }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-high/60 p-3">
      <p className="text-[12.5px] font-semibold mb-2">
        {doc} <span className="text-rose-ink">*</span>{' '}
        <span className="text-ink-faint font-normal">— both sides</span>
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        <PhotoSide doc={doc} side="Front" file={front} onChange={setFront} />
        <PhotoSide doc={doc} side="Back" file={back} onChange={setBack} />
      </div>
    </div>
  )
}

/* ---------------- Page ---------------- */
export default function Onboard() {
  const [f, setF] = useState({
    name: '',
    designation: '',
    area: '',
    location: '',
    fixedSalary: '',
    expenseComponent: '',
  })
  const [aadhaarFront, setAadhaarFront] = useState(null)
  const [aadhaarBack, setAadhaarBack] = useState(null)
  const [panFront, setPanFront] = useState(null)
  const [panBack, setPanBack] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))
  const photoCount = [aadhaarFront, aadhaarBack, panFront, panBack].filter(Boolean).length
  // What still stands between the person and the Submit button, in order.
  const missing = [
    !f.name.trim() && 'your full name',
    !f.designation && 'a designation',
    photoCount < 4 && `${4 - photoCount} more document ${4 - photoCount === 1 ? 'photo' : 'photos'}`,
  ].filter(Boolean)
  const valid = missing.length === 0

  const submit = async (e) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      const fd = new FormData()
      Object.entries(f).forEach(([k, v]) => fd.append(k, v))
      fd.append('aadhaarFront', aadhaarFront)
      fd.append('aadhaarBack', aadhaarBack)
      fd.append('panFront', panFront)
      fd.append('panBack', panBack)
      const res = await fetch(`${API_BASE}/onboard`, { method: 'POST', body: fd })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || `Submission failed (${res.status})`)
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setF({ name: '', designation: '', area: '', location: '', fixedSalary: '', expenseComponent: '' })
    setAadhaarFront(null)
    setAadhaarBack(null)
    setPanFront(null)
    setPanBack(null)
    setDone(false)
    setError(null)
  }

  return (
    <div className="portal-noble min-h-dvh bg-paper px-4 py-8 sm:py-12">
      <div className="max-w-xl mx-auto">
        {/* Brand — Noble Diagnostics */}
        <div className="flex items-center gap-3 mb-6">
          <div className="size-10 rounded-[11px] bg-surface-high ring-1 ring-hairline grid place-items-center shrink-0">
            <NobleMark size={28} />
          </div>
          <div className="leading-tight">
            <p className="font-display font-bold text-[17px] tracking-tight text-accent-text">Noble Diagnostics</p>
            <p className="text-[10.5px] text-ink-faint uppercase tracking-[0.16em]">Field onboarding</p>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.div key="done" {...fadeUp} className="bg-surface rounded-2xl border border-hairline shadow-card p-8 text-center">
            <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring, delay: 0.12 }} className="w-fit mx-auto mb-3">
              <CheckCircle size={48} weight="fill" className="text-mint" />
            </motion.div>
            <h1 className="font-display text-[20px] font-bold tracking-tight">Details submitted</h1>
            <p className="text-[13.5px] text-ink-soft mt-2 max-w-sm mx-auto">
              Thank you — the Noble Diagnostics HR team has received the details and will complete
              the onboarding. No further action is needed right now.
            </p>
            <button
              onClick={reset}
              className="mt-5 inline-flex items-center gap-2 h-10 px-4 rounded-[10px] border border-hairline bg-surface-high hover:border-hairline-strong active:scale-[0.97] text-[13px] font-semibold transition-[border-color,transform] duration-[var(--dur-fast)] cursor-pointer"
            >
              Submit another person
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            {...fadeUp}
            onSubmit={submit}
            className="bg-surface rounded-2xl border border-hairline shadow-card p-6 sm:p-7"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="size-10 rounded-xl bg-accent-soft text-accent-text grid place-items-center">
                <IdentificationCard size={20} />
              </div>
              <div>
                <h1 className="font-display text-[21px] font-bold tracking-tight">Join the Noble field team</h1>
                <p className="text-[12.5px] text-ink-faint">
                  Takes about two minutes. Keep your Aadhaar and PAN cards handy.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Field label="Full name" required>
                <input className={inputCls} value={f.name} onChange={set('name')} placeholder="As per Aadhaar" />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Designation" required>
                  <select
                    className={cx(inputCls, 'cursor-pointer', !f.designation && 'text-ink-faint')}
                    value={f.designation}
                    onChange={set('designation')}
                  >
                    <option value="">Select designation</option>
                    {DESIGNATIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Area">
                  <input className={inputCls} value={f.area} onChange={set('area')} placeholder="e.g. Rohtak belt" />
                </Field>
              </div>

              <Field label="Location">
                <input className={inputCls} value={f.location} onChange={set('location')} placeholder="City / town of posting" />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Fixed salary (₹ / month)">
                  <input
                    className={inputCls}
                    value={f.fixedSalary}
                    onChange={set('fixedSalary')}
                    inputMode="numeric"
                    placeholder="e.g. 25000"
                  />
                </Field>
                <Field label="Expense component (₹ / month)">
                  <input
                    className={inputCls}
                    value={f.expenseComponent}
                    onChange={set('expenseComponent')}
                    inputMode="numeric"
                    placeholder="e.g. 5000"
                  />
                </Field>
              </div>

              <div className="pt-1 space-y-3">
                <DocPhotos
                  doc="Aadhaar card"
                  front={aadhaarFront}
                  setFront={setAadhaarFront}
                  back={aadhaarBack}
                  setBack={setAadhaarBack}
                />
                <DocPhotos
                  doc="PAN card"
                  front={panFront}
                  setFront={setPanFront}
                  back={panBack}
                  setBack={setPanBack}
                />
              </div>
            </div>

            <AnimatePresence initial={false}>
              {error && (
                <motion.div key="error" {...collapse} className="overflow-hidden" role="alert">
                  <p className="mt-4 text-[12.5px] text-rose-ink bg-rose-soft rounded-lg px-3 py-2">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Progress toward a complete form: four photos is the long part. */}
            <div className="mt-5" aria-live="polite">
              <div className="flex items-center justify-between text-[11.5px] mb-1.5">
                <span className={cx('font-semibold', valid ? 'text-mint' : 'text-ink-soft')}>
                  {valid ? 'Ready to submit' : `Still needed: ${missing.join(', ')}`}
                </span>
                <span className="font-mono text-ink-faint shrink-0 ml-3">{photoCount}/4 photos</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-soft overflow-hidden">
                <motion.div
                  className={cx('h-full rounded-full', valid ? 'bg-mint' : 'bg-accent')}
                  initial={false}
                  animate={{ width: `${((photoCount + (f.name.trim() ? 1 : 0) + (f.designation ? 1 : 0)) / 6) * 100}%` }}
                  transition={{ duration: DUR.slow, ease: EASE_OUT }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!valid || busy}
              className="mt-3 w-full h-11 inline-flex items-center justify-center gap-2 rounded-[10px] bg-accent enabled:hover:bg-accent-deep enabled:active:scale-[0.98] disabled:bg-slate-soft disabled:text-ink-faint disabled:cursor-not-allowed text-white text-[14px] font-semibold transition-[background-color,transform] duration-[var(--dur-fast)] enabled:cursor-pointer"
            >
              {busy ? <CircleNotch size={17} className="animate-spin" /> : <PaperPlaneTilt size={17} />}
              {busy ? 'Submitting…' : 'Submit details'}
            </button>

            <p className="text-[11px] text-ink-faint text-center mt-3">
              Your documents are transmitted securely and visible only to Noble HR.
            </p>
          </motion.form>
        )}
        </AnimatePresence>

        <p className="text-[11px] text-ink-faint text-center mt-6">
          Noble Diagnostics · Qugen Pathlabs Pvt. Ltd. · Powered by Stellar Apex People OS
        </p>
      </div>
    </div>
  )
}
