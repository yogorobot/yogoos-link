import yolinkIcon from '../../../../../assets/icon.png';

interface ConnectionSidebarLogoProps {
  hasUpdate: boolean;
  updateVersion?: string;
  onOpenUpdate: () => void;
}

export default function ConnectionSidebarLogo({
  hasUpdate,
  updateVersion,
  onOpenUpdate,
}: ConnectionSidebarLogoProps) {
  const content = (
    <>
      <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl border border-blue-400/25 bg-slate-950/40 shadow-lg shadow-blue-950/20">
        <img src={yolinkIcon} alt="YOLINK" className="h-9 w-9 object-contain" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-[0.18em] text-slate-100">
          YOLINK
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">WORKSPACE</p>
        {hasUpdate && (
          <p className="mt-1 truncate text-[11px] font-medium text-blue-200/80">
            有新版本
            {updateVersion ? ` · ${updateVersion}` : ''}
          </p>
        )}
      </div>
    </>
  );

  if (hasUpdate) {
    return (
      <button
        type="button"
        className="yogo-panel hidden shrink-0 items-center gap-3 rounded-3xl px-4 py-3 text-left transition hover:border-blue-300/45 hover:bg-blue-500/10 focus:outline-none focus:ring-2 focus:ring-blue-500/40 min-[861px]:flex"
        onClick={onOpenUpdate}
      >
        {content}
      </button>
    );
  }

  return (
    <section className="yogo-panel hidden shrink-0 items-center gap-3 rounded-3xl px-4 py-3 min-[861px]:flex">
      {content}
    </section>
  );
}
