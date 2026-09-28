import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import { User } from '@/app/App';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';
import { ShieldCheck, RefreshCw, Info, ClipboardList, Search, Calendar, ChevronLeft, ChevronRight, Eye, Clock, UserCheck, CheckCircle2, RotateCcw } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';

interface AuditLogsProps {
    currentUser: User;
}

export function AuditLogs({ currentUser }: AuditLogsProps) {
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('today');
    const [isLoading, setIsLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedLog, setSelectedLog] = useState<any | null>(null);
    const itemsPerPage = 15;

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/audit_logs.php');
            const data = await res.json();
            setAuditLogs(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Audit Logs fetch error:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000); // Auto-refresh every 5 seconds
        return () => clearInterval(interval);
    }, []);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, dateFilter]);

    const filteredLogsList = auditLogs.filter(log => {
        const matchesSearch = 
            log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(log.action).toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(log.details).toLowerCase().includes(searchTerm.toLowerCase());
        
        if (!matchesSearch) return false;

        if (dateFilter === 'all') return true;

        const logDate = new Date(log.timestamp);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const logDay = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());

        if (dateFilter === 'today') {
            return logDay.getTime() === today.getTime();
        }
        if (dateFilter === 'weekly') {
            const lastWeek = new Date(today);
            lastWeek.setDate(today.getDate() - 7);
            lastWeek.setHours(0, 0, 0, 0);

            return logDate >= lastWeek && logDate <= now;
        }
        if (dateFilter === 'monthly') {
            return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
        }
        if (dateFilter === 'yearly') {
            return logDate.getFullYear() === now.getFullYear();
        }
        return true;
    });

    const totalPages = Math.max(1, Math.ceil(filteredLogsList.length / itemsPerPage));
    const paginatedLogs = filteredLogsList.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    return (
        <ErrorBoundary fallbackTitle="Audit Logs Module Error">
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                            <ClipboardList className="size-7 text-indigo-600" />
                            System Audit Logs
                        </h2>
                        <p className="text-sm text-gray-500 font-medium">Complete chronicle of all pharmacy activities and system modifications</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                            <Input 
                                placeholder="Search trail..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 bg-white border-gray-200 h-10 shadow-sm"
                            />
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-white border-gray-200 hover:bg-gray-50 font-black h-10 px-4 shadow-sm"
                            onClick={fetchLogs}
                            disabled={isLoading}
                        >
                            <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                <Card className="border-none shadow-xl bg-white overflow-hidden">
                    <CardHeader className="bg-slate-800 text-white py-5 flex flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-700 rounded-lg">
                                <ShieldCheck className="size-6 text-green-400" />
                            </div>
                            <div>
                                <CardTitle className="text-lg font-black uppercase tracking-widest">History & Compliance Trail</CardTitle>
                                <CardDescription className="text-slate-400 font-medium text-xs mt-0.5">Secure, immutable record of inventory, sales, and user actions</CardDescription>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-700/50 px-3 py-1.5 rounded-lg border border-slate-600">
                            <Calendar className="size-4 text-slate-300" />
                            <Select value={dateFilter} onValueChange={setDateFilter}>
                                <SelectTrigger className="w-[130px] border-none shadow-none h-6 font-bold text-[10px] p-0 focus:ring-0 text-white bg-transparent">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="border-slate-700 bg-slate-800 text-white font-bold">
                                    <SelectItem value="all">All Time History</SelectItem>
                                    <SelectItem value="today">Today Activity</SelectItem>
                                    <SelectItem value="weekly">Weekly (Last 7 Days)</SelectItem>
                                    <SelectItem value="monthly">This Month</SelectItem>
                                    <SelectItem value="yearly">This Year</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="min-h-[520px] overflow-x-auto w-full">
                            <Table className="min-w-[850px]">
                                <TableHeader className="bg-slate-50 border-b border-gray-200">
                                    <TableRow>
                                        <TableHead className="w-[15%] font-black uppercase text-[10px] text-gray-500 py-3.5 pl-6">Staff Member</TableHead>
                                        <TableHead className="w-[14%] font-black uppercase text-[10px] text-gray-500 py-3.5 text-center">Action Type</TableHead>
                                        <TableHead className="w-[43%] font-black uppercase text-[10px] text-gray-500 py-3.5">Action Summary</TableHead>
                                        <TableHead className="w-[18%] font-black uppercase text-[10px] text-gray-500 py-3.5 text-right">Date & Time</TableHead>
                                        <TableHead className="w-[10%] font-black uppercase text-[10px] text-gray-500 py-3.5 text-center pr-6">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="divide-y divide-gray-100">
                                    {paginatedLogs.length > 0 ? (
                                        paginatedLogs.map((log) => (
                                            <TableRow 
                                                key={log.id} 
                                                onClick={() => setSelectedLog(log)}
                                                className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                                            >
                                                <TableCell className="py-3 pl-6 font-bold text-slate-900 text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <div className="size-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-[10px] font-black shrink-0">
                                                            {log.userName.substring(0, 1).toUpperCase()}
                                                        </div>
                                                        <span className="truncate max-w-[120px]">{log.userName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="py-3 text-center">
                                                    <Badge variant="outline" className={`
                                                        text-[9px] font-black uppercase h-5 px-2 border-none shadow-sm whitespace-nowrap
                                                        ${log.action.includes('Sale') ? 'bg-emerald-100 text-emerald-700' : 
                                                          log.action.includes('Void') ? 'bg-red-100 text-red-700' :
                                                          log.action.includes('Inventory') ? 'bg-blue-100 text-blue-700' : 
                                                          log.action.includes('Delete') ? 'bg-rose-100 text-rose-700' : 
                                                          log.action.includes('Rotation') ? 'bg-amber-100 text-amber-700' :
                                                          log.action.includes('Purchase Order') ? 'bg-indigo-100 text-indigo-700' :
                                                          'bg-slate-100 text-slate-700'}
                                                    `}>
                                                        {log.action}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="py-3 text-[11px] text-slate-600 font-medium group-hover:text-slate-900">
                                                    <p className="truncate max-w-[360px] lg:max-w-[480px]" title={log.details}>
                                                        {log.details}
                                                    </p>
                                                </TableCell>
                                                <TableCell className="py-3 text-[10px] text-slate-400 font-mono font-bold text-right whitespace-nowrap">
                                                    {log.timestamp ? new Date(log.timestamp.includes('T') ? log.timestamp : log.timestamp.replace(' ', 'T')).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                                                </TableCell>
                                                <TableCell className="py-3 pr-6 text-center">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}
                                                        className="h-7 px-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100/60 rounded-md flex items-center gap-1 mx-auto"
                                                    >
                                                        <Eye className="size-3" />
                                                        <span>View</span>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="py-32 text-center">
                                                <div className="flex flex-col items-center gap-3 text-slate-200">
                                                    <Info className="size-16" />
                                                    <div className="space-y-1">
                                                        <p className="font-black text-slate-400 text-lg">No Audit Results</p>
                                                        <p className="text-sm font-medium text-slate-400">Try adjusting your search filters</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination Footer - System Standard Design */}
                        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-xl">
                            <div className="text-sm text-gray-500 font-medium">
                                Showing <span className="text-gray-900 font-bold">{filteredLogsList.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="text-gray-900 font-bold">{Math.min(currentPage * itemsPerPage, filteredLogsList.length)}</span> of <span className="text-gray-900 font-bold">{filteredLogsList.length}</span> actions
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="bg-white border-gray-200 hover:bg-gray-100 disabled:opacity-50"
                                >
                                    <ChevronLeft className="size-4 mr-1" />
                                    Previous
                                </Button>
                                <div className="flex items-center gap-1 hidden sm:flex">
                                    {(() => {
                                        const pages = [];
                                        let start = Math.max(1, currentPage - 1);
                                        if (start + 2 > totalPages) start = Math.max(1, totalPages - 2);
                                        let end = Math.min(totalPages, start + 2);

                                        for (let i = start; i <= end; i++) {
                                            pages.push(i);
                                        }

                                        return (
                                            <>
                                                {start > 1 && <span className="text-gray-400 px-1">...</span>}
                                                {pages.map(page => (
                                                    <Button
                                                        key={page}
                                                        variant={currentPage === page ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => setCurrentPage(page)}
                                                        className={`size-8 p-0 font-bold ${currentPage === page ? "bg-gray-900 text-white" : "bg-white border-gray-200"}`}
                                                    >
                                                        {page}
                                                    </Button>
                                                ))}
                                                {end < totalPages && <span className="text-gray-400 px-1">...</span>}
                                            </>
                                        );
                                    })()}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage >= totalPages}
                                    className="bg-white border-gray-200 hover:bg-gray-100 disabled:opacity-50"
                                >
                                    Next
                                    <ChevronRight className="size-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Audit Action Detailed Chronicle Dialog */}
                <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
                    <DialogContent className="max-w-xl bg-white p-6 rounded-2xl shadow-2xl border-0 overflow-hidden">
                        {selectedLog && (
                            <div className="space-y-4">
                                <DialogHeader className="pb-3 border-b border-gray-100 text-left">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="size-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow">
                                                <ClipboardList className="size-6" />
                                            </div>
                                            <div>
                                                <DialogTitle className="text-lg font-black text-gray-900">
                                                    System Action Details
                                                </DialogTitle>
                                                <DialogDescription className="text-xs text-gray-500 font-medium">
                                                    Audit Trail Record #{selectedLog.id}
                                                </DialogDescription>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className={`
                                            text-[10px] font-black uppercase px-2.5 py-1 border-none shadow-sm
                                            ${selectedLog.action.includes('Sale') ? 'bg-emerald-100 text-emerald-700' : 
                                              selectedLog.action.includes('Void') ? 'bg-red-100 text-red-700' :
                                              selectedLog.action.includes('Inventory') ? 'bg-blue-100 text-blue-700' : 
                                              selectedLog.action.includes('Delete') ? 'bg-rose-100 text-rose-700' : 
                                              selectedLog.action.includes('Rotation') ? 'bg-amber-100 text-amber-700' :
                                              selectedLog.action.includes('Purchase Order') ? 'bg-indigo-100 text-indigo-700' :
                                              'bg-slate-100 text-slate-700'}
                                        `}>
                                            {selectedLog.action}
                                        </Badge>
                                    </div>
                                </DialogHeader>

                                {/* Staff & Timestamp Grid */}
                                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                                    <div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Staff Performed</span>
                                        <span className="font-black text-gray-900 text-sm flex items-center gap-1.5 mt-0.5">
                                            <UserCheck className="size-3.5 text-indigo-600" />
                                            {selectedLog.userName}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Timestamp</span>
                                        <span className="font-bold text-gray-800 font-mono text-xs flex items-center gap-1.5 mt-0.5">
                                            <Clock className="size-3.5 text-slate-500" />
                                            {selectedLog.timestamp ? new Date(selectedLog.timestamp.includes('T') ? selectedLog.timestamp : selectedLog.timestamp.replace(' ', 'T')).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : 'N/A'}
                                        </span>
                                    </div>
                                </div>

                                {/* Full Action Chronicle Box */}
                                <div className="space-y-1.5 text-left">
                                    <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                                        Complete Action Chronicle
                                    </span>
                                    <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-xs leading-relaxed border border-slate-800 max-h-56 overflow-y-auto whitespace-pre-wrap select-text shadow-inner">
                                        {selectedLog.details}
                                    </div>
                                </div>

                                {/* Visual Breakdown (Parsed Highlights if available) */}
                                {(() => {
                                    const text = String(selectedLog.details || '');
                                    const txMatch = text.match(/Transaction #(\d+)/i);
                                    const refundMatch = text.match(/Refunded:\s*([₱P]?[\d,.]+)/i);
                                    const restoredMatch = text.match(/Restored items:\s*([^.]+?)(?=\.\s*Remaining|\.\s*Order|$)/i);
                                    const remainingMatch = text.match(/Remaining Total:\s*([₱P]?[\d,.]+)/i);
                                    const changeMatch = text.match(/Updated Change:\s*([₱P]?[\d,.]+)/i);

                                    if (txMatch || refundMatch || restoredMatch || remainingMatch) {
                                        return (
                                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 text-xs space-y-2 text-left">
                                                <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider block">
                                                    Action Breakdown Summary
                                                </span>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {txMatch && (
                                                        <div className="bg-white p-2 rounded-lg border border-gray-200">
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase block">Transaction</span>
                                                            <span className="font-black text-gray-900">#{txMatch[1]}</span>
                                                        </div>
                                                    )}
                                                    {refundMatch && (
                                                        <div className="bg-red-50 p-2 rounded-lg border border-red-200">
                                                            <span className="text-[9px] font-bold text-red-600 uppercase block">Refund Amount</span>
                                                            <span className="font-black text-red-700">{refundMatch[1].startsWith('₱') ? refundMatch[1] : `₱${refundMatch[1]}`}</span>
                                                        </div>
                                                    )}
                                                    {remainingMatch && (
                                                        <div className="bg-white p-2 rounded-lg border border-gray-200">
                                                            <span className="text-[9px] font-bold text-gray-400 uppercase block">Remaining Total</span>
                                                            <span className="font-black text-gray-900">{remainingMatch[1].startsWith('₱') ? remainingMatch[1] : `₱${remainingMatch[1]}`}</span>
                                                        </div>
                                                    )}
                                                    {changeMatch && (
                                                        <div className="bg-blue-50 p-2 rounded-lg border border-blue-200">
                                                            <span className="text-[9px] font-bold text-blue-600 uppercase block">Updated Sukli</span>
                                                            <span className="font-black text-blue-700">{changeMatch[1].startsWith('₱') ? changeMatch[1] : `₱${changeMatch[1]}`}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {restoredMatch && restoredMatch[1].trim() && (
                                                    <div className="bg-white p-2.5 rounded-lg border border-gray-200 mt-2">
                                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block mb-1">Restored to Inventory</span>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {restoredMatch[1].split(',').map((it, idx) => (
                                                                <span key={idx} className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">
                                                                    ✓ {it.trim()}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                                <div className="flex justify-between items-center pt-2 border-t border-gray-100 text-[11px] text-gray-400 font-medium">
                                    <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                                        <ShieldCheck className="size-4" />
                                        Verified Immutable Audit Trail
                                    </span>
                                    <Button
                                        onClick={() => setSelectedLog(null)}
                                        className="bg-slate-900 hover:bg-black text-white font-bold h-9 px-5 rounded-lg text-xs"
                                    >
                                        Close
                                    </Button>
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </ErrorBoundary>
    );
}
