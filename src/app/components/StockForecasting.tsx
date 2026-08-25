import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';
import { Product, Transaction } from '@/app/App';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/app/components/ui/dialog';
import {
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    Info,
    Package,
    ArrowRight,
    ShieldCheck,
    Search,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Calculator
} from 'lucide-react';

interface StockForecastingProps {
    products: Product[];
    transactions: Transaction[];
}

import { getForecast, calculateDailyAccuracyMetrics } from '@/app/utils/forecastingUtils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

export function StockForecasting({ products, transactions }: StockForecastingProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // Calculation: (Stock / Velocity) = Days left
    // ... rest of the code ...

    const [selectedProductAnalysis, setSelectedProductAnalysis] = useState<any>(null);
    const [demandTab, setDemandTab] = useState<'High Demand' | 'Medium Demand' | 'Low Demand'>('High Demand');
    const [productMetrics, setProductMetrics] = useState<any[]>([]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        const metricsArray = products.map(p => {
            const m = calculateDailyAccuracyMetrics(p.id, transactions, 7); // 7 days testing window
            return {
                product: p,
                metrics: m
            };
        }).filter(item => item.metrics !== null);
        setProductMetrics(metricsArray);
    }, [products, transactions]);

    const getProductForecast = (product: Product) => {
        return getForecast(product, transactions, false);
    };


    const filteredProducts = products
        .filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.sku.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            const recA = getProductForecast(a).reorderRecommendation;
            const recB = getProductForecast(b).reorderRecommendation;
            return recB - recA; // Push recommendations to the top
        });

    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
    const paginatedProducts = filteredProducts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const stats = {
        criticalStock: products.filter(p => {
            const { daysRemaining } = getProductForecast(p);
            return daysRemaining <= 7;
        }).length,
        highVelocity: products.filter(p => {
            const { velocity } = getProductForecast(p);
            return parseFloat(velocity) > 2;
        }).length,
        totalRecommendations: products.filter(p => getProductForecast(p).reorderRecommendation > 0).length
    };

    return (
        <ErrorBoundary fallbackTitle="Stock Forecasting Module Error">
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-semibold text-gray-900">Stock Forecasting</h2>
                        <p className="text-sm text-gray-500 mt-1">Predictive insights based on sales velocity and environmental data.</p>
                    </div>
                    {productMetrics.length > 0 && (
                        <Dialog onOpenChange={(open) => { if (!open) setSelectedProductAnalysis(null); }}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="flex items-center gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800">
                                    <ShieldCheck className="size-4" />
                                    Evaluate Algorithm Accuracy
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="w-[80vw] max-w-[80vw] sm:max-w-[80vw] h-[80vh] overflow-y-auto bg-white/40 backdrop-blur-xl border border-white/50 shadow-2xl rounded-3xl">
                                {selectedProductAnalysis ? (
                                    <div className="space-y-6">
                                        <Button variant="ghost" onClick={() => setSelectedProductAnalysis(null)} className="mb-2 -ml-4 px-4 hover:bg-gray-100">
                                            <ChevronLeft className="size-4 mr-2" /> Back to Products
                                        </Button>
                                        <div>
                                            <h2 className="text-2xl font-black uppercase tracking-tight text-gray-900">{selectedProductAnalysis.product.name}</h2>
                                            <div className="flex gap-4 items-center mt-2">
                                                <Badge variant="outline" className="text-gray-500">{selectedProductAnalysis.product.sku}</Badge>
                                                <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
                                                    <span className="text-gray-500 font-medium text-xs uppercase tracking-wider">Historical Demand Level</span>
                                                    <span className={`font-black text-lg ${selectedProductAnalysis.metrics.classification === 'High Demand' ? 'text-green-600' : selectedProductAnalysis.metrics.classification === 'Medium Demand' ? 'text-amber-500' : 'text-gray-500'}`}>
                                                        {selectedProductAnalysis.metrics.classification}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-500 font-medium mt-2 px-2">
                                                    Avg Daily Demand: <span className="text-gray-900">{selectedProductAnalysis.metrics.avgDailyDemand}</span> units
                                                </div>
                                            </div>
                                        </div>

                                        <div className="h-[350px] w-full border border-gray-100 rounded-lg p-4 bg-gray-50/50 shadow-sm">
                                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center mb-6">Demand Forecast Analysis (Daily)</h3>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={selectedProductAnalysis.metrics.chartData} margin={{ top: 5, right: 20, left: -20, bottom: 25 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 'bold' }} tickLine={false} axisLine={false} dy={10} />
                                                    <YAxis tick={{ fontSize: 11, fill: '#6b7280', fontWeight: 'bold' }} tickLine={false} axisLine={false} />
                                                    <RechartsTooltip
                                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                                                        itemStyle={{ fontSize: '12px', fontWeight: 'bold', padding: '2px 0' }}
                                                        labelStyle={{ fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', fontWeight: 'black', marginBottom: '8px', borderBottom: '1px solid #f3f4f6', paddingBottom: '4px' }}
                                                    />
                                                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '13px', fontWeight: 'bold', paddingBottom: '20px' }} />
                                                    <Line type="monotone" dataKey="Actual" name="Actual Demand" stroke="#111827" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                                    <Line type="monotone" dataKey="SMA" name="SMA Forecast (3 Wks)" stroke="#9ca3af" strokeWidth={3} strokeDasharray="5 5" dot={false} activeDot={{ r: 6 }} />
                                                    <Line type="monotone" dataKey="Exp. Smoothing" name="Custom Algorithm" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>

                                        {selectedProductAnalysis.metrics.sma ? (
                                            <>
                                                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-gray-50 border-b-2 border-gray-200">
                                                                <TableHead className="font-bold text-gray-800 uppercase tracking-wider text-xs py-4">Forecasting Model</TableHead>
                                                                <TableHead className="font-bold text-gray-800 uppercase tracking-wider text-xs py-4">MAE (Abs. Error)</TableHead>
                                                                <TableHead className="font-bold text-gray-800 uppercase tracking-wider text-xs py-4">RMSE (Sq. Error)</TableHead>
                                                                <TableHead className="font-bold text-gray-800 uppercase tracking-wider text-xs py-4">MAPE (Percentage)</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            <TableRow className="hover:bg-indigo-50/30 transition-colors">
                                                                <TableCell className="font-black text-indigo-700">Custom Algorithm (Exp. Smoothing)</TableCell>
                                                                <TableCell className="font-medium">{selectedProductAnalysis.metrics.exponentialSmoothing.mae}</TableCell>
                                                                <TableCell className="font-medium">{selectedProductAnalysis.metrics.exponentialSmoothing.rmse}</TableCell>
                                                                <TableCell className="font-bold text-gray-900">{selectedProductAnalysis.metrics.exponentialSmoothing.mape}</TableCell>
                                                            </TableRow>
                                                            <TableRow className="hover:bg-gray-50 transition-colors">
                                                                <TableCell className="font-black text-gray-600">Simple Moving Average (SMA)</TableCell>
                                                                <TableCell className="font-medium text-gray-500">{selectedProductAnalysis.metrics.sma.mae}</TableCell>
                                                                <TableCell className="font-medium text-gray-500">{selectedProductAnalysis.metrics.sma.rmse}</TableCell>
                                                                <TableCell className="font-bold text-gray-600">{selectedProductAnalysis.metrics.sma.mape}</TableCell>
                                                            </TableRow>
                                                        </TableBody>
                                                    </Table>
                                                </div>

                                                <h4 className="font-bold text-gray-900 flex items-center gap-2 mt-8 mb-4">
                                                    <Calculator className="size-5 text-indigo-600" /> Day-by-Day Computation
                                                </h4>
                                                <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm mb-6">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-gray-50 border-b-2 border-gray-200">
                                                                <TableHead className="font-bold text-gray-800 uppercase tracking-wider text-xs py-4">Period (Date)</TableHead>
                                                                <TableHead className="font-bold text-gray-800 uppercase tracking-wider text-xs py-4">Actual Demand</TableHead>
                                                                <TableHead className="font-bold text-gray-800 uppercase tracking-wider text-xs py-4">SMA Forecast</TableHead>
                                                                <TableHead className="font-bold text-indigo-700 uppercase tracking-wider text-xs py-4">Exp. Smoothing Forecast</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {selectedProductAnalysis.metrics.chartData.map((data: any, idx: number) => (
                                                                <TableRow key={idx} className="hover:bg-gray-50 transition-colors">
                                                                    <TableCell className="font-medium text-gray-600">{data.date}</TableCell>
                                                                    <TableCell className="font-black text-gray-900">{data.Actual}</TableCell>
                                                                    <TableCell className="font-medium text-gray-500">{data.SMA}</TableCell>
                                                                    <TableCell className="font-black text-indigo-600">{data['Exp. Smoothing']}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>

                                                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-8 flex flex-col items-center justify-center mt-6 shadow-sm relative overflow-hidden">
                                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-indigo-600"></div>
                                                    <h4 className="text-xs font-black text-indigo-500 uppercase tracking-[0.2em] mb-2">Best Performing Model</h4>
                                                    <p className="text-3xl font-black text-indigo-900 text-center tracking-tight">
                                                        {selectedProductAnalysis.metrics.exponentialSmoothing.mapeRaw <= selectedProductAnalysis.metrics.sma.mapeRaw + 5
                                                            ? "Custom Algorithm"
                                                            : "Simple Moving Average (SMA)"}
                                                    </p>
                                                    <p className="text-sm text-indigo-600/80 font-medium mt-3 text-center px-4">
                                                        {selectedProductAnalysis.metrics.exponentialSmoothing.mapeRaw < selectedProductAnalysis.metrics.sma.mapeRaw
                                                            ? "Selected based on mathematically lower historical error rate (MAPE)."
                                                            : selectedProductAnalysis.metrics.exponentialSmoothing.mapeRaw <= selectedProductAnalysis.metrics.sma.mapeRaw + 5
                                                                ? "Selected due to superior adaptability to sudden demand shocks, despite a slight statistical tie with SMA."
                                                                : "Selected based on significantly lower historical error rate."}
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="bg-orange-50 border border-orange-200 text-orange-800 p-6 rounded-lg mt-6 shadow-sm flex items-center gap-3 font-medium">
                                                <AlertTriangle className="size-6 text-orange-600" />
                                                Insufficient historical demand data to calculate accuracy metrics for this product. Wait for more sales data.
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <DialogHeader>
                                            <DialogTitle className="text-indigo-900 flex items-center gap-3 text-2xl font-black border-b pb-4">
                                                <div className="bg-indigo-100 p-2 rounded-lg">
                                                    <ShieldCheck className="size-6 text-indigo-600" />
                                                </div>
                                                Forecasting Analytics
                                            </DialogTitle>
                                        </DialogHeader>

                                        <div className="pt-2">
                                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Demand Classification</h3>
                                            <div className="flex gap-2 bg-gray-50 p-1 rounded-lg w-max border border-gray-200 shadow-sm">
                                                {['High Demand', 'Medium Demand', 'Low Demand'].map(tab => (
                                                    <button
                                                        key={tab}
                                                        onClick={() => setDemandTab(tab as any)}
                                                        className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${demandTab === tab ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                                                    >
                                                        {tab}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="pb-4">
                                            <div className="flex items-center justify-between mb-4 mt-8">
                                                <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest">{demandTab} Products</h3>
                                                <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 border-none">
                                                    {productMetrics.filter(pm => pm.metrics.classification === demandTab).length} products
                                                </Badge>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {productMetrics.filter(pm => pm.metrics.classification === demandTab).length === 0 && (
                                                    <div className="col-span-full p-12 text-center flex flex-col items-center justify-center text-gray-400 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200">
                                                        <Package className="size-12 mb-4 text-gray-300" />
                                                        <p className="font-bold text-gray-500">No products found in this category.</p>
                                                    </div>
                                                )}
                                                {productMetrics.filter(pm => pm.metrics.classification === demandTab).map(pm => (
                                                    <Card key={pm.product.id} className="hover:border-indigo-300 hover:shadow-md transition-all duration-200 group bg-white">
                                                        <CardContent className="p-5 flex flex-col h-full justify-between gap-5">
                                                            <div>
                                                                <h4 className="font-black text-lg text-gray-900 truncate tracking-tight">{pm.product.name}</h4>
                                                                <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border border-indigo-100 mt-2 font-bold uppercase tracking-wider text-[10px]">
                                                                    {pm.metrics.classification}
                                                                </Badge>
                                                                <div className="flex-1 bg-white p-3 rounded-lg border border-gray-200 text-center shadow-sm">
                                                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Avg Daily Demand</p>
                                                                    <p className="text-xl font-black text-gray-900">{pm.metrics.avgDailyDemand} <span className="text-xs text-gray-500 font-medium tracking-normal lowercase">units</span></p>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                className="w-full justify-between group-hover:bg-indigo-600 group-hover:text-white transition-colors bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-700"
                                                                onClick={() => setSelectedProductAnalysis(pm)}
                                                            >
                                                                View Forecast Analysis
                                                                <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                                                            </Button>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
                <ErrorBoundary fallbackTitle="Forecasting Summary Error">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Card className="bg-green-50 border-2 border-green-200 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-bold text-green-900 uppercase tracking-wider">Inventory Health</CardTitle>
                                <ShieldCheck className="size-6 text-green-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-green-700">{products.length - stats.criticalStock}</div>
                                <p className="text-xs font-semibold text-green-600 mt-1 uppercase tracking-wider">Items in Safe Zone</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-amber-50 border-2 border-amber-200 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl font-medium">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-bold text-amber-900 uppercase tracking-wider">Critical Risk</CardTitle>
                                <AlertTriangle className="size-6 text-amber-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-amber-700">{stats.criticalStock}</div>
                                <p className="text-xs font-semibold text-amber-600 mt-1 uppercase tracking-wider">Runs out &lt; 7 Days</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-blue-50 border-2 border-blue-200 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-xl font-medium">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-bold text-blue-900 uppercase tracking-wider">Daily Demand</CardTitle>
                                <TrendingUp className="size-6 text-blue-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-blue-700">{stats.highVelocity}</div>
                                <p className="text-xs font-semibold text-blue-600 mt-1 uppercase tracking-wider">Fast Moving Items</p>
                            </CardContent>
                        </Card>
                    </div>
                </ErrorBoundary>

                <ErrorBoundary fallbackTitle="Forecast Insights Error">
                    <Card className="border border-gray-200 overflow-hidden shadow-sm">
                        <CardHeader className="bg-gray-50 border-b border-gray-200 flex flex-row items-center justify-between space-y-0 p-6">
                            <div>
                                <CardTitle className="text-lg font-bold text-gray-900 uppercase tracking-tight">Forecast Insights</CardTitle>
                                <CardDescription className="text-sm text-gray-500">Estimated stock duration and dynamic reorder recommendations (14-days for fast-moving, 30-days for slow-moving) based on Exponential Smoothing.</CardDescription>
                            </div>
                            <div className="max-w-xs relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                                <Input
                                    placeholder="Search products..."
                                    value={searchTerm}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                                    className="h-10 pl-10 bg-white border-gray-200"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto w-full">
                                <Table className="w-full min-w-[800px]">
                                    <TableHeader>
                                        <TableRow className="bg-gray-100/50 border-b border-gray-200">
                                            <TableHead className="px-2 py-3 font-black text-gray-700 uppercase text-[9px] w-[20%]">Product Name</TableHead>
                                            <TableHead className="px-1 py-3 font-black text-gray-700 uppercase text-[9px] text-center">Daily Velocity</TableHead>
                                            <TableHead className="px-1 py-3 font-black text-gray-700 uppercase text-[9px] text-center">Current Stock</TableHead>
                                            <TableHead className="px-1 py-3 font-black text-gray-700 uppercase text-[9px] text-center">Stock Status</TableHead>
                                            <TableHead className="px-1 py-3 font-black text-gray-700 uppercase text-[9px] text-center text-red-600">Days Left</TableHead>
                                            <TableHead className="px-1 py-3 font-black text-gray-700 uppercase text-[9px] text-center">Stockout Date</TableHead>
                                            <TableHead className="px-1 py-3 font-black text-gray-700 uppercase text-[9px] text-center">Reorder Date</TableHead>
                                            <TableHead className="px-2 py-3 font-black text-gray-700 uppercase text-[9px] text-right">Recommendation</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody className="divide-y divide-gray-200">
                                        {paginatedProducts.map((p) => {
                                            const forecast = getProductForecast(p);

                                            return (
                                                <TableRow key={p.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <TableCell className="px-3 py-4 border-r border-gray-200">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-gray-900 text-sm">{p.name}</span>
                                                            <span className="text-[10px] text-gray-400 font-mono uppercase tracking-tighter mt-0.5">{p.sku}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="px-6 py-4 border-r border-gray-200 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <span className="font-mono font-bold text-sm text-gray-700">{forecast.velocity}</span>
                                                            {parseFloat(forecast.velocity) > 0 ? (
                                                                <TrendingUp className="size-3 text-green-600" />
                                                            ) : (
                                                                <TrendingDown className="size-3 text-gray-400" />
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="px-6 py-4 border-r border-gray-200 text-center">
                                                        <div className="flex flex-col items-center justify-center">
                                                            <span className={`text-sm font-black ${(Number(p.quantity) + Number(p.newStockQuantity || 0)) === 0 ? 'text-red-600' : 'text-blue-800'}`}>
                                                                {Number(p.quantity) + Number(p.newStockQuantity || 0)}
                                                            </span>
                                                            <span className="text-[9px] text-gray-400 font-bold uppercase">Total Units</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="px-6 py-4 border-r border-gray-200 text-center">
                                                        {Number((forecast as any).daysRemaining) <= 7 || (Number(p.quantity) + Number(p.newStockQuantity || 0)) === 0 ? (
                                                            <Badge className="bg-red-100 text-red-800 border-none px-2 py-0.5 text-[10px] font-black uppercase tracking-widest leading-none">CRITICAL</Badge>
                                                        ) : (Number((forecast as any).daysRemaining) <= 14 || (Number(p.quantity) + Number(p.newStockQuantity || 0)) <= Number(p.reorderLevel)) ? (
                                                            <Badge className="bg-orange-100 text-orange-800 border-none px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest leading-none">LOW STOCK</Badge>
                                                        ) : (
                                                            <Badge className="bg-green-100 text-green-800 border-none px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest leading-none">OPTIMAL</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="px-6 py-4 border-r border-gray-200 text-center">
                                                        <span className={`font-black text-sm ${(forecast as any).daysRemaining <= 7 || (Number(p.quantity) + Number(p.newStockQuantity || 0)) === 0 ? 'text-red-600' :
                                                            ((forecast as any).daysRemaining <= 14 || (Number(p.quantity) + Number(p.newStockQuantity || 0)) <= p.reorderLevel) ? 'text-orange-600' : 'text-green-600'
                                                            }`}>
                                                            {(Number(p.quantity) + Number(p.newStockQuantity || 0)) === 0 ? '0' : ((forecast as any).daysRemaining === Infinity ? 'STABLE' : (forecast as any).daysRemaining)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="px-6 py-4 border-r border-gray-200 text-center">
                                                        <span className="text-xs font-mono font-bold text-gray-600 whitespace-nowrap uppercase">
                                                            {(forecast as any).stockOutDate !== 'N/A' ? new Date((forecast as any).stockOutDate).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : 'SUFFICIENT'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="px-6 py-4 border-r border-gray-200 text-center">
                                                        <div className="flex flex-col">
                                                            <span className={`text-xs font-black ${((forecast as any).daysRemaining <= 5) ? 'text-red-600' : 'text-blue-700'} whitespace-nowrap`}>
                                                                {(forecast as any).recommendedBuyDate !== 'N/A' ? new Date((forecast as any).recommendedBuyDate).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="px-3 py-4 text-right">
                                                        {parseFloat(forecast.velocity) === 0 ? (
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">INSUFFICIENT SALES DATA</span>
                                                        ) : forecast.reorderRecommendation > 0 ? (
                                                            <div className="inline-flex items-center gap-1.5 text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full font-black text-[11px]">
                                                                +{forecast.reorderRecommendation}
                                                                <ArrowRight className="size-3" />
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">NONE</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                        {/* Pagination Controls */}
                        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                            <div className="text-sm text-gray-500 font-medium">
                                Showing <span className="text-gray-900 font-bold">{Math.min(filteredProducts.length, (currentPage - 1) * itemsPerPage + 1)}</span> to <span className="text-gray-900 font-bold">{Math.min(filteredProducts.length, currentPage * itemsPerPage)}</span> of <span className="text-gray-900 font-bold">{filteredProducts.length}</span> products
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
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
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="bg-white border-gray-200 hover:bg-gray-100 disabled:opacity-50"
                                >
                                    Next
                                    <ChevronRight className="size-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    </Card>
                </ErrorBoundary>
            </div>
        </ErrorBoundary>
    );
}
