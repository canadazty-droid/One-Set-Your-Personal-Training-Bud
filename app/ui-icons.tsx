import {
  ArrowLeftRight,
  ArrowRight,
  AudioWaveform,
  BicepsFlexed,
  BookOpen,
  Camera,
  ChartNoAxesColumnIncreasing,
  Check,
  CircleAlert,
  CircleUserRound,
  Dumbbell,
  Footprints,
  House,
  Info,
  Mic,
  Minus,
  PersonStanding,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Video,
  type LucideIcon,
} from "lucide-react";

export type AppIconName =
  | "today"
  | "workout"
  | "library"
  | "progress"
  | "profile"
  | "voice"
  | "listening"
  | "full-body"
  | "upper-body"
  | "lower-body"
  | "push-pull"
  | "core"
  | "arrow-right"
  | "plus"
  | "minus"
  | "check"
  | "refresh"
  | "video"
  | "camera"
  | "starter"
  | "info"
  | "play"
  | "repeat"
  | "alert"
  | "sparkles";

const icons: Record<AppIconName, LucideIcon> = {
  today: House,
  workout: Dumbbell,
  library: BookOpen,
  progress: ChartNoAxesColumnIncreasing,
  profile: CircleUserRound,
  voice: Mic,
  listening: AudioWaveform,
  "full-body": PersonStanding,
  "upper-body": BicepsFlexed,
  "lower-body": Footprints,
  "push-pull": ArrowLeftRight,
  core: Target,
  "arrow-right": ArrowRight,
  plus: Plus,
  minus: Minus,
  check: Check,
  refresh: RefreshCw,
  video: Video,
  camera: Camera,
  starter: ShieldCheck,
  info: Info,
  play: Play,
  repeat: RotateCcw,
  alert: CircleAlert,
  sparkles: Sparkles,
};

export function AppIcon({name,className}:{name:AppIconName;className?:string}) {
  const Icon=icons[name];
  return <Icon className={["app-icon",className].filter(Boolean).join(" ")} aria-hidden="true" focusable="false" strokeWidth={2} absoluteStrokeWidth/>;
}
