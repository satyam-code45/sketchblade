import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface IconButtonProps {
  icon: ReactNode;
  onClick: () => void;
  activated: boolean;
}

export default function IconButton({
  icon,
  onClick,
  activated,
}: IconButtonProps) {
  return (
    <div
      className={cn(
        "cursor-pointer rounded-full border p-2 text-white hover:bg-gray-600 ",
        activated ? "bg-green-600" : "bg-gray-900"
      )}
      onClick={onClick}
    >
      {icon}
    </div>
  );
}
