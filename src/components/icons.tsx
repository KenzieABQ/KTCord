"use client"

// Icons in Discord's style: Phosphor's filled shapes (bell, gear, mic...) and bold strokes for
// thin glyphs (×, ✓, +, arrows). Exported under the names the app has always used, so call
// sites stay as they were. Each defaults to 24px, like before; size them with classes.

import type { IconProps, Icon as PhosphorIcon } from "@phosphor-icons/react"
import {
  Airplane,
  AppleLogo,
  ArrowBendUpLeft,
  ArrowBendUpRight,
  ArrowClockwise,
  ArrowDown,
  ArrowSquareOut,
  ArrowsClockwise,
  ArrowsOut,
  At,
  Bell,
  BellSlash,
  CalendarBlank,
  CalendarPlus,
  Camera,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  CellSignalFull,
  ChartBar,
  ChatCentered,
  ChatCenteredSlash,
  ChatCenteredText,
  ChatCircle,
  Chats,
  Check,
  CheckCircle,
  Checks,
  CircleNotch,
  Clock,
  Compass,
  Copy,
  Crown,
  DotsSixVertical,
  DotsThree,
  DotsThreeVertical,
  DownloadSimple,
  EnvelopeSimpleOpen,
  Eye,
  EyeSlash,
  File,
  Flag,
  FolderPlus,
  Gavel,
  GearSix,
  Hash,
  Headphones,
  Heart,
  Hourglass,
  Info,
  Leaf,
  Lightbulb,
  LinkSimple,
  List,
  Lock,
  MagnifyingGlass,
  MapPin,
  Megaphone,
  Microphone,
  MicrophoneSlash,
  Monitor,
  MonitorArrowUp,
  Paperclip,
  PencilSimple,
  Phone,
  PhoneCall,
  PhoneDisconnect,
  Play,
  Plus,
  PlusCircle,
  Prohibit,
  PushPin,
  PushPinSlash,
  Question,
  Rectangle,
  Scroll,
  Shield,
  SignOut,
  Smiley,
  SpeakerHigh,
  SpeakerSlash,
  SquaresFour,
  Star,
  Trash,
  Trophy,
  UploadSimple,
  User,
  UserMinus,
  UserPlus,
  UserSquare,
  Users,
  VideoCamera,
  VideoCameraSlash,
  Warning,
  WarningCircle,
  X,
  XCircle,
} from "@phosphor-icons/react/dist/ssr"
import { forwardRef, type ComponentProps, type ReactNode } from "react"

import { cn } from "@/lib/utils"

type Props = Omit<IconProps, "weight"> & {
  /** Lucide-only; ignored. */
  strokeWidth?: number | string
  absoluteStrokeWidth?: boolean
}

function icon(Base: PhosphorIcon, weight: "fill" | "bold", name: string) {
  const Icon = forwardRef<SVGSVGElement, Props>(function Icon({ strokeWidth, absoluteStrokeWidth, size = 24, ...props }, ref) {
    void strokeWidth
    void absoluteStrokeWidth
    return <Base ref={ref} weight={weight} size={size} aria-hidden={props["aria-label"] ? undefined : true} {...props} />
  })
  Icon.displayName = name
  return Icon
}

/** A filled icon with a Discord-style slash through it (for icons Phosphor has no slashed version of). */
function slashed(Base: PhosphorIcon, name: string) {
  function Icon({ className, size = 24, ...props }: Props & ComponentProps<"span">) {
    return (
      <span
        aria-hidden={props["aria-label"] ? undefined : true}
        {...(props as ComponentProps<"span">)}
        className={cn("relative inline-block shrink-0", className)}
        style={{ width: className?.includes("size-") ? undefined : size, height: className?.includes("size-") ? undefined : size }}
      >
        <Base
          weight="fill"
          className="absolute inset-0 size-full"
          style={{
            maskImage: "linear-gradient(45deg, #000 44%, transparent 44%, transparent 58%, #000 58%)",
            WebkitMaskImage: "linear-gradient(45deg, #000 44%, transparent 44%, transparent 58%, #000 58%)",
          }}
        />
        <svg viewBox="0 0 24 24" className="absolute inset-0 size-full" aria-hidden>
          <path d="M3 3 21 21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </span>
    )
  }
  Icon.displayName = name
  return Icon
}

/** A filled icon with a small plus badge (Discord's "add reaction"). */
function plussed(Base: PhosphorIcon, name: string) {
  function Icon({ className, size = 24, ...props }: Props & ComponentProps<"span">): ReactNode {
    return (
      <span
        aria-hidden={props["aria-label"] ? undefined : true}
        {...(props as ComponentProps<"span">)}
        className={cn("relative inline-block shrink-0", className)}
        style={{ width: className?.includes("size-") ? undefined : size, height: className?.includes("size-") ? undefined : size }}
      >
        <Base
          weight="fill"
          className="absolute inset-0 size-full"
          style={{
            maskImage: "radial-gradient(circle at 86% 14%, transparent 30%, #000 31%)",
            WebkitMaskImage: "radial-gradient(circle at 86% 14%, transparent 30%, #000 31%)",
          }}
        />
        <svg viewBox="0 0 24 24" className="absolute inset-0 size-full" aria-hidden>
          <path d="M20.5 1.5v6M17.5 4.5h6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </span>
    )
  }
  Icon.displayName = name
  return Icon
}

export const AppleIcon = icon(AppleLogo, "fill", "AppleIcon")
export const ArrowDownIcon = icon(ArrowDown, "bold", "ArrowDownIcon")
export const AtSignIcon = icon(At, "bold", "AtSignIcon")
export const BarChart3Icon = icon(ChartBar, "fill", "BarChart3Icon")
export const BellIcon = icon(Bell, "fill", "BellIcon")
export const BellOffIcon = icon(BellSlash, "fill", "BellOffIcon")
export const CalendarIcon = icon(CalendarBlank, "fill", "CalendarIcon")
export const CalendarPlusIcon = icon(CalendarPlus, "fill", "CalendarPlusIcon")
export const CameraIcon = icon(Camera, "fill", "CameraIcon")
export const CheckCheckIcon = icon(Checks, "bold", "CheckCheckIcon")
export const CheckCircle2Icon = icon(CheckCircle, "fill", "CheckCircle2Icon")
export const CheckIcon = icon(Check, "bold", "CheckIcon")
export const ChevronDownIcon = icon(CaretDown, "bold", "ChevronDownIcon")
export const ChevronLeftIcon = icon(CaretLeft, "bold", "ChevronLeftIcon")
export const ChevronRightIcon = icon(CaretRight, "bold", "ChevronRightIcon")
export const ChevronUpIcon = icon(CaretUp, "bold", "ChevronUpIcon")
export const CircleAlertIcon = icon(WarningCircle, "fill", "CircleAlertIcon")
export const CircleCheckIcon = icon(CheckCircle, "fill", "CircleCheckIcon")
export const CircleHelpIcon = icon(Question, "fill", "CircleHelpIcon")
export const ClockIcon = icon(Clock, "fill", "ClockIcon")
export const CompassIcon = icon(Compass, "fill", "CompassIcon")
export const CopyIcon = icon(Copy, "fill", "CopyIcon")
export const CrownIcon = icon(Crown, "fill", "CrownIcon")
export const DownloadIcon = icon(DownloadSimple, "bold", "DownloadIcon")
export const ExternalLinkIcon = icon(ArrowSquareOut, "bold", "ExternalLinkIcon")
export const EyeIcon = icon(Eye, "fill", "EyeIcon")
export const EyeOffIcon = icon(EyeSlash, "fill", "EyeOffIcon")
export const FileIcon = icon(File, "fill", "FileIcon")
export const FlagIcon = icon(Flag, "fill", "FlagIcon")
export const FolderPlusIcon = icon(FolderPlus, "fill", "FolderPlusIcon")
export const ForwardIcon = icon(ArrowBendUpRight, "bold", "ForwardIcon")
export const GavelIcon = icon(Gavel, "fill", "GavelIcon")
export const GripVerticalIcon = icon(DotsSixVertical, "bold", "GripVerticalIcon")
export const HashIcon = icon(Hash, "bold", "HashIcon")
export const HeadphonesIcon = icon(Headphones, "fill", "HeadphonesIcon")
export const HeartIcon = icon(Heart, "fill", "HeartIcon")
export const HourglassIcon = icon(Hourglass, "fill", "HourglassIcon")
export const InfoIcon = icon(Info, "fill", "InfoIcon")
export const LayoutGridIcon = icon(SquaresFour, "fill", "LayoutGridIcon")
export const LeafIcon = icon(Leaf, "fill", "LeafIcon")
export const LightbulbIcon = icon(Lightbulb, "fill", "LightbulbIcon")
export const LinkIcon = icon(LinkSimple, "bold", "LinkIcon")
export const Loader2Icon = icon(CircleNotch, "bold", "Loader2Icon")
export const LoaderIcon = icon(CircleNotch, "bold", "LoaderIcon")
export const LockIcon = icon(Lock, "fill", "LockIcon")
export const LogOutIcon = icon(SignOut, "bold", "LogOutIcon")
export const MailCheckIcon = icon(EnvelopeSimpleOpen, "fill", "MailCheckIcon")
export const MapPinIcon = icon(MapPin, "fill", "MapPinIcon")
export const MaximizeIcon = icon(ArrowsOut, "bold", "MaximizeIcon")
export const MegaphoneIcon = icon(Megaphone, "fill", "MegaphoneIcon")
export const MenuIcon = icon(List, "bold", "MenuIcon")
export const MessageCircleIcon = icon(ChatCircle, "fill", "MessageCircleIcon")
export const MessageSquareIcon = icon(ChatCentered, "fill", "MessageSquareIcon")
export const MessageSquareTextIcon = icon(ChatCenteredText, "fill", "MessageSquareTextIcon")
export const MessageSquareXIcon = icon(ChatCenteredSlash, "fill", "MessageSquareXIcon")
export const MessagesSquareIcon = icon(Chats, "fill", "MessagesSquareIcon")
export const MicIcon = icon(Microphone, "fill", "MicIcon")
export const MicOffIcon = icon(MicrophoneSlash, "fill", "MicOffIcon")
export const MonitorUpIcon = icon(MonitorArrowUp, "fill", "MonitorUpIcon")
export const MoreHorizontalIcon = icon(DotsThree, "bold", "MoreHorizontalIcon")
export const MoreVerticalIcon = icon(DotsThreeVertical, "bold", "MoreVerticalIcon")
export const OctagonXIcon = icon(XCircle, "fill", "OctagonXIcon")
export const PaperclipIcon = icon(Paperclip, "bold", "PaperclipIcon")
export const PencilIcon = icon(PencilSimple, "fill", "PencilIcon")
export const PhoneOffIcon = icon(PhoneDisconnect, "fill", "PhoneOffIcon")
export const PinIcon = icon(PushPin, "fill", "PinIcon")
export const PinOffIcon = icon(PushPinSlash, "fill", "PinOffIcon")
export const PlaneIcon = icon(Airplane, "fill", "PlaneIcon")
export const PlayIcon = icon(Play, "fill", "PlayIcon")
export const PlusCircleIcon = icon(PlusCircle, "fill", "PlusCircleIcon")
export const PlusIcon = icon(Plus, "bold", "PlusIcon")
export const RectangleHorizontalIcon = icon(Rectangle, "fill", "RectangleHorizontalIcon")
export const ReplyIcon = icon(ArrowBendUpLeft, "bold", "ReplyIcon")
export const RotateCwIcon = icon(ArrowClockwise, "bold", "RotateCwIcon")
export const ScrollTextIcon = icon(Scroll, "fill", "ScrollTextIcon")
export const SearchIcon = icon(MagnifyingGlass, "bold", "SearchIcon")
export const ServerCrashIcon = icon(Warning, "fill", "ServerCrashIcon")
export const SettingsIcon = icon(GearSix, "fill", "SettingsIcon")
export const ShieldIcon = icon(Shield, "fill", "ShieldIcon")
export const SignalIcon = icon(CellSignalFull, "fill", "SignalIcon")
export const SlashIcon = icon(Prohibit, "bold", "SlashIcon")
export const SmileIcon = icon(Smiley, "fill", "SmileIcon")
export const StarIcon = icon(Star, "fill", "StarIcon")
export const TrashIcon = icon(Trash, "fill", "TrashIcon")
export const TriangleAlertIcon = icon(Warning, "fill", "TriangleAlertIcon")
export const TrophyIcon = icon(Trophy, "fill", "TrophyIcon")
export const UploadIcon = icon(UploadSimple, "bold", "UploadIcon")
export const UserIcon = icon(User, "fill", "UserIcon")
export const UserMinusIcon = icon(UserMinus, "fill", "UserMinusIcon")
export const UserPlusIcon = icon(UserPlus, "fill", "UserPlusIcon")
export const UserSquareIcon = icon(UserSquare, "fill", "UserSquareIcon")
export const UsersIcon = icon(Users, "fill", "UsersIcon")
export const VideoIcon = icon(VideoCamera, "fill", "VideoIcon")
export const VideoOffIcon = icon(VideoCameraSlash, "fill", "VideoOffIcon")
export const Volume2Icon = icon(SpeakerHigh, "fill", "Volume2Icon")
export const VolumeXIcon = icon(SpeakerSlash, "fill", "VolumeXIcon")
export const XIcon = icon(X, "bold", "XIcon")
export const RefreshCwIcon = icon(ArrowsClockwise, "bold", "RefreshCwIcon")
export const PhoneIcon = icon(Phone, "fill", "PhoneIcon")
export const PhoneCallIcon = icon(PhoneCall, "fill", "PhoneCallIcon")
export const HeadphoneOffIcon = slashed(Headphones, "HeadphoneOffIcon")
export const MonitorOffIcon = slashed(Monitor, "MonitorOffIcon")
export const SmilePlusIcon = plussed(Smiley, "SmilePlusIcon")
