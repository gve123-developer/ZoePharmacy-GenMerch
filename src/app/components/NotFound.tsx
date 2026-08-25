import { Button } from "@/app/components/ui/button";
import { Search } from "lucide-react";

interface NotFoundProps {
  onBackToDashboard?: () => void;
  title?: string;
  message?: React.ReactNode;
}

export function NotFound({
  onBackToDashboard,
  title = "404 - Page Not Found",
  message = "Oops! The page you are looking for doesn't exist or has been moved."
}: NotFoundProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <div className="bg-red-50 p-6 rounded-full mb-6">
        <Search className="size-16 text-red-600 animate-pulse" />
      </div>
      <h1 className="text-6xl font-black text-gray-900 mb-4">{title.split(' ')[0]}</h1>
      <h2 className="text-2xl font-bold text-gray-800 mb-4">{title.substring(title.indexOf('-') + 1).trim()}</h2>
      <p className="text-gray-500 max-w-md mb-8 leading-relaxed">
        {message}
      </p>
      {onBackToDashboard && (
        <Button
          onClick={onBackToDashboard}
          className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-3 rounded-lg font-bold shadow-lg transition-all hover:scale-105"
        >
          Back to Dashboard
        </Button>
      )}
    </div>
  );
}
