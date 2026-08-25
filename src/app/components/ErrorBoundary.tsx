import React, { Component, ErrorInfo, ReactNode } from "react";
import { RefreshCw, Terminal, AlertCircle, Lightbulb } from "lucide-react";
import { Button } from "@/app/components/ui/button";

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[500px] bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xl flex flex-col font-sans animate-in fade-in duration-300">
          {/* Laravel Ignition Style Header */}
          <div className="bg-[#FF2D20] p-6 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <AlertCircle className="size-6 text-white" />
              </div>
              <h2 className="text-white text-xl font-bold tracking-tight">
                {this.props.fallbackTitle || "Application Error"}
              </h2>
            </div>
            <div className="mt-2">
              <p className="text-white/90 text-2xl font-black font-mono break-all leading-tight">
                {this.state.error?.message || "Something went wrong."}
              </p>
            </div>
          </div>

          <div className="flex-1 bg-[#F8FAFC] p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-y-auto">
            {/* Left Side: Solutions & Suggestions */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center gap-2 mb-4 text-[#FF2D20]">
                  <Lightbulb className="size-5 font-bold" />
                  <h3 className="font-bold uppercase tracking-widest text-xs">Suggested Solution</h3>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">
                  This error is likely caused by a <strong>{this.state.error?.name === 'TypeError' ? 'logic flaw' : 'runtime exception'}</strong>. 
                </p>
                <ul className="space-y-2 text-sm text-gray-700 italic border-l-2 border-[#FF2D20]/20 pl-4">
                  <li>• Check for undefined variables</li>
                  <li>• Verify the data structure mapping</li>
                  <li>• Ensure all required props are passed</li>
                </ul>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <Button 
                  variant="default" 
                  onClick={() => window.location.reload()}
                  className="bg-[#2D3748] hover:bg-[#1A202C] text-white h-12 rounded-lg font-bold uppercase tracking-wider text-xs shadow-lg transition-all"
                >
                  <RefreshCw className="size-4 mr-2" />
                  Refresh and Fix
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => this.setState({ hasError: false, error: null })}
                  className="h-12 border-2 border-gray-200 hover:bg-gray-50 text-gray-500 rounded-lg font-bold uppercase tracking-wider text-xs"
                >
                  Try Again
                </Button>
              </div>
            </div>

            {/* Right Side: Error Code / Stack Trace */}
            <div className="lg:col-span-8">
              <div className="bg-[#1A202C] rounded-xl overflow-hidden shadow-2xl h-full flex flex-col border border-gray-800">
                <div className="bg-[#2D3748] px-4 py-3 flex items-center justify-between border-b border-gray-700">
                  <div className="flex items-center gap-2">
                    <Terminal className="size-4 text-gray-400" />
                    <span className="text-gray-300 font-mono text-xs font-semibold">Stack Trace Diagnostics</span>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="size-2.5 rounded-full bg-[#FF2D20]/80"></div>
                    <div className="size-2.5 rounded-full bg-yellow-400/80"></div>
                    <div className="size-2.5 rounded-full bg-green-400/80"></div>
                  </div>
                </div>
                <div className="p-6 overflow-x-auto flex-1 font-mono text-xs leading-loose custom-scrollbar">
                  <pre className="text-pink-300 whitespace-pre-wrap selection:bg-[#FF2D20]/50 selection:text-white">
                    {this.state.error?.stack || this.state.error?.toString()}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Laravel Footer Style */}
          <div className="bg-white border-t border-gray-100 p-4 text-center">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">
              Zoe Pharmacy & GM • Error Handling Framework • v.2.7
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
