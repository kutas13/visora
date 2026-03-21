interface CustomerAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  status?: "vize_onay" | "red" | "islemde" | "onay_geldi" | "default";
}

const STATUS_STYLES: Record<string, { bg: string; ring: string; text: string }> = {
  vize_onay: { bg: "bg-emerald-500", ring: "ring-emerald-500/20", text: "text-white" },
  red: { bg: "bg-red-500", ring: "ring-red-500/20", text: "text-white" },
  islemde: { bg: "bg-blue-500", ring: "ring-blue-500/20", text: "text-white" },
  onay_geldi: { bg: "bg-amber-400", ring: "ring-amber-400/20", text: "text-white" },
  default: { bg: "bg-orange-400", ring: "ring-orange-400/20", text: "text-white" },
};

const SIZES = {
  sm: { container: "w-8 h-8", font: "text-xs" },
  md: { container: "w-9 h-9", font: "text-[13px]" },
  lg: { container: "w-11 h-11", font: "text-base" },
};

export function resolveAvatarStatus(file: {
  sonuc?: string | null;
  basvuru_yapildi?: boolean | null;
  dosya_hazir?: boolean | null;
}): CustomerAvatarProps["status"] {
  if (file.sonuc === "vize_onay") return "vize_onay";
  if (file.sonuc === "red") return "red";
  if (file.basvuru_yapildi) return "islemde";
  if (file.dosya_hazir) return "onay_geldi";
  return "default";
}

export default function CustomerAvatar({ name, size = "md", status = "default" }: CustomerAvatarProps) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.default;
  const sz = SIZES[size];

  return (
    <div className={`${sz.container} ${s.bg} rounded-full flex items-center justify-center ring-[3px] ${s.ring} flex-shrink-0`}>
      <span className={`${s.text} font-bold ${sz.font} leading-none`}>
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
