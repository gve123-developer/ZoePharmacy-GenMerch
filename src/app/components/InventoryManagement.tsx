import { useState, useEffect } from 'react';
import { User, Product } from '@/app/App';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Search, Package, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { ErrorBoundary } from '@/app/components/ErrorBoundary';
import { logAuditAction } from '@/app/utils/auditUtils';

interface InventoryManagementProps {
  currentUser: User;
  products: Product[];
  onProductsChange: (products: Product[]) => void;
}

const categories = ['Pharmaceutical', 'Non-pharmaceutical'];

export function InventoryManagement({ currentUser, products, onProductsChange }: InventoryManagementProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStockStatus, setFilterStockStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAddProduct = async () => {
    if (!formData.name || !formData.sku || !formData.category || !formData.price || !formData.cost || !formData.quantity || !formData.reorderLevel) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/products.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Name': currentUser.name
        },
        body: JSON.stringify({
          ...formData,
          newStockQuantity: formData.newStockQuantity || 0,
          newStockExpiry: formData.newStockExpiry || null
        })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Product added successfully');
        logAuditAction(
          currentUser.name,
          'Inventory Add',
          `Added new product: ${formData.name} [SKU: ${formData.sku}] | Initial Qty: ${formData.quantity} | New Stock: ${formData.newStockQuantity || 0}`
        );
        setIsAddDialogOpen(false);
        setFormData({});
        const updatedProducts = await fetch('/api/products.php').then(res => res.json());
        onProductsChange(updatedProducts);
      } else {
        toast.error('Failed to add product: ' + data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error connecting to API');
    }
  };

  const handleEditProduct = async () => {
    if (!editingProduct) return;

    try {
      const response = await fetch(`/api/products.php?id=${editingProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Name': currentUser.name
        },
        body: JSON.stringify({ ...editingProduct, ...formData })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Product updated successfully');
        logAuditAction(
          currentUser.name,
          'Inventory Update',
          `Updated product: ${formData.name} [SKU: ${formData.sku}] | Base Qty: ${formData.quantity} | New Stock: ${formData.newStockQuantity || 0}`
        );
        setIsEditDialogOpen(false);
        setEditingProduct(null);
        setFormData({});
        const updatedProducts = await fetch('/api/products.php').then(res => res.json());
        onProductsChange(updatedProducts);
      } else {
        toast.error('Failed to update product: ' + data.message);
      }
    } catch (e) {
      console.error(e);
      toast.error('Error connecting to API');
    }
  };

  const handleDeleteProduct = (product: Product) => {
    setProductToDelete(product);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/products.php?id=${productToDelete.id}`, {
        method: 'DELETE',
        headers: { 'X-User-Name': currentUser.name }
      });
      const data = await response.json();
      if (data.success) {
        toast.success(`"${productToDelete.name}" deleted successfully`);
        logAuditAction(
          currentUser.name,
          'Inventory Delete',
          `Deleted product: ${productToDelete.name} [SKU: ${productToDelete.sku}]`
        );
        const updatedProducts = await fetch('/api/products.php').then(res => res.json());
        onProductsChange(updatedProducts);
      } else {
        toast.error('Failed to delete: ' + data.message);
      }
    } catch (e) {
      console.error(e);
      toast.error('Error connecting to API');
    } finally {
      setIsDeleting(false);
      setProductToDelete(null);
    }
  };

  const checkStockStatus = (p: Product) => {
    const total = Number(p.quantity) + Number(p.newStockQuantity || 0);
    if (total === 0) return 'out';
    if (total <= Number(p.reorderLevel)) return 'low';
    return 'in';
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || product.category === filterCategory;
    const matchesStock = filterStockStatus === 'all' || checkStockStatus(product) === filterStockStatus;
    return matchesSearch && matchesCategory && matchesStock;
  });

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredProducts.length]);

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData(product);
    setIsEditDialogOpen(true);
  };

  const getStockStatus = (product: Product) => {
    const total = Number(product.quantity) + Number(product.newStockQuantity || 0);
    if (total === 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-800' };
    if (total <= product.reorderLevel) return { label: 'Low Stock', color: 'bg-orange-100 text-orange-800' };
    return { label: 'In Stock', color: 'bg-green-100 text-green-800' };
  };

  return (
    <ErrorBoundary fallbackTitle="Inventory Management Module Error">
      <div className="space-y-6">
        {/* Delete Confirmation Dialog */}
        <Dialog open={!!productToDelete} onOpenChange={(open) => { if (!open && !isDeleting) setProductToDelete(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="size-5" />
                Delete Product
              </DialogTitle>
              <DialogDescription className="pt-2">
                Are you sure you want to delete <span className="font-bold text-gray-900">&ldquo;{productToDelete?.name}&rdquo;</span>?
                <br />
                <span className="text-red-500 text-xs mt-1 block">This action cannot be undone. All associated sales history will also be removed.</span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4 gap-2">
              <Button variant="outline" onClick={() => setProductToDelete(null)} disabled={isDeleting}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Inventory Summary Cards */}
        <ErrorBoundary fallbackTitle="Inventory Summary Error">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-white border-2 border-blue-100 shadow-sm transition-all hover:scale-[1.01]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-blue-900 uppercase tracking-wider">Total Products</CardTitle>
                <Package className="size-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-blue-700">{products.length}</div>
                <p className="text-xs font-semibold text-blue-600 mt-1 uppercase tracking-wider">Unique items</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-2 border-green-100 shadow-sm transition-all hover:scale-[1.01]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-bold text-green-900 uppercase tracking-wider">Total Units</CardTitle>
                <Layers className="size-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-green-700">
                  {products.reduce((sum, p) => sum + (Number(p.quantity) + Number(p.newStockQuantity || 0)), 0)}
                </div>
                <p className="text-xs font-semibold text-green-600 mt-1 uppercase tracking-wider">Aggregate Stock Count</p>
              </CardContent>
            </Card>
          </div>
        </ErrorBoundary>

        {/* Header */}
        <ErrorBoundary fallbackTitle="Inventory Header Error">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Inventory Management</h2>
              <p className="text-sm text-gray-500 mt-1">Manage your products and stock levels</p>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4 mr-2" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Product</DialogTitle>
                  <DialogDescription>Enter the details of the new product</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Product Name *</Label>
                    <Input id="name" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU *</Label>
                    <Input id="sku" value={formData.sku || ''} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select value={formData.category || ''} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity *</Label>
                    <Input id="quantity" type="number" value={formData.quantity || ''} onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Selling Price (₱) *</Label>
                    <Input id="price" type="number" step="0.01" value={formData.price || ''} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost">Cost Price (₱) *</Label>
                    <Input id="cost" type="number" step="0.01" value={formData.cost || ''} onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reorderLevel">Reorder Level *</Label>
                    <Input id="reorderLevel" type="number" value={formData.reorderLevel || ''} onChange={(e) => setFormData({ ...formData, reorderLevel: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiryDate">Expiry Date</Label>
                    <Input id="expiryDate" type="date" value={formData.expiryDate || ''} onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })} />
                  </div>
                  <div className="col-span-2 p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-3 my-2">
                    <h4 className="text-xs font-black text-blue-700 uppercase tracking-widest flex items-center gap-2">
                      <Plus className="size-3" /> New Stock (Rotation Support)
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="newBatchQuantity" className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">New Stock Qty</Label>
                        <Input id="newBatchQuantity" type="number" placeholder="Optional" value={formData.newStockQuantity || ''} onChange={(e) => setFormData({ ...formData, newStockQuantity: Number(e.target.value) })} className="bg-white border-blue-200" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="newBatchExpiry" className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">New Stock Expiry</Label>
                        <Input id="newBatchExpiry" type="date" value={formData.newStockExpiry || ''} onChange={(e) => setFormData({ ...formData, newStockExpiry: e.target.value })} className="bg-white border-blue-200" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); setFormData({}); }}>Cancel</Button>
                  <Button onClick={handleAddProduct}>Add Product</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </ErrorBoundary>

        <ErrorBoundary fallbackTitle="Inventory Table Error">
          <Card>
            {/* INLINE COMPACT FILTERS */}
            <CardContent className="p-4 border-b border-gray-100 bg-gray-50/20">
              <div className="flex flex-col lg:flex-row gap-5">
                {/* Category Filter */}
                <div className="flex-1 space-y-2">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Category Filter</h3>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant={filterCategory === 'all' ? 'default' : 'outline'}
                      onClick={() => { setFilterCategory('all'); setCurrentPage(1); }}
                      className="h-8 text-[10px] font-bold px-3 rounded-md"
                    >
                      ALL ({products.length})
                    </Button>
                    {categories.map(cat => {
                      const count = products.filter(p => p.category === cat).length;
                      return (
                        <Button
                          key={cat}
                          size="sm"
                          variant={filterCategory === cat ? 'default' : 'outline'}
                          onClick={() => { setFilterCategory(cat); setCurrentPage(1); }}
                          className="h-8 text-[10px] font-bold px-3 rounded-md"
                        >
                          {cat.toUpperCase()} ({count})
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Stock Status Filter */}
                <div className="flex-1 space-y-2">
                  <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">Stock Status</h3>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => { setFilterStockStatus('all'); setCurrentPage(1); }}
                      className={`h-8 text-[10px] font-bold px-3 rounded-md ${filterStockStatus === 'all'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white text-gray-500 border-gray-200'
                        }`}
                    >
                      ALL LEVELS
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => { setFilterStockStatus('in'); setCurrentPage(1); }}
                      className={`h-8 text-[10px] font-bold px-3 rounded-md ${filterStockStatus === 'in'
                          ? 'bg-green-600 text-white shadow-sm'
                          : 'bg-white text-green-700 border-green-100'
                        }`}
                    >
                      IN STOCK ({products.filter(p => (Number(p.quantity) + Number(p.newStockQuantity || 0)) > Number(p.reorderLevel)).length})
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => { setFilterStockStatus('low'); setCurrentPage(1); }}
                      className={`h-8 text-[10px] font-bold px-3 rounded-md ${filterStockStatus === 'low'
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'bg-white text-orange-700 border-orange-200'
                        }`}
                    >
                      LOW STOCK ({products.filter(p => {
                        const total = Number(p.quantity) + Number(p.newStockQuantity || 0);
                        return total > 0 && total <= Number(p.reorderLevel);
                      }).length})
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => { setFilterStockStatus('out'); setCurrentPage(1); }}
                      className={`h-8 text-[10px] font-bold px-3 rounded-md ${filterStockStatus === 'out'
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'bg-white text-red-700 border-red-200'
                        }`}
                    >
                      OUT OF STOCK ({products.filter(p => (Number(p.quantity) + Number(p.newStockQuantity || 0)) === 0).length})
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>

            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6">
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <Package className="size-5 text-gray-700" />
                Products ({filteredProducts.length})
              </CardTitle>
              <div className="max-w-xs relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="h-10 pl-10 bg-white border-gray-200"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow className="bg-gray-50 border-b border-gray-200">
                      <TableHead className="px-6 py-4 font-bold text-gray-700 uppercase text-xs tracking-wider border-r border-gray-200">Product Details</TableHead>
                      <TableHead className="px-6 py-4 font-bold text-gray-700 uppercase text-xs tracking-wider border-r border-gray-200 text-center">Old Stock</TableHead>
                      <TableHead className="px-6 py-4 font-bold text-gray-700 uppercase text-xs tracking-wider border-r border-gray-200 text-center">New Stock</TableHead>
                      <TableHead className="px-6 py-4 font-bold text-gray-700 uppercase text-xs tracking-wider border-r border-gray-200">Price/Cost</TableHead>
                      <TableHead className="px-6 py-4 font-bold text-gray-700 uppercase text-xs tracking-wider border-r border-gray-200">Status</TableHead>
                      <TableHead className="px-6 py-4 font-bold text-gray-700 uppercase text-xs tracking-wider">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-gray-200">
                    {paginatedProducts.map((product) => {
                      const status = getStockStatus(product);
                      return (
                        <TableRow key={product.id} className="hover:bg-gray-50/50 transition-colors">
                          <TableCell className="px-6 py-4 border-r border-gray-200">
                            <div className="flex flex-col">
                              <span className="font-bold text-gray-900">{product.name}</span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-gray-400 font-black uppercase tracking-tighter bg-gray-100 px-1 rounded">{product.sku}</span>
                                <span className="text-[10px] text-blue-500 font-bold uppercase">{product.category}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-6 py-4 border-r border-gray-200 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <span className={`text-md font-black ${Number(product.quantity) === 0 ? 'text-red-600' : 'text-gray-900'}`}>{Number(product.quantity) === 0 ? '-' : product.quantity}</span>
                              <span className="text-[9px] text-gray-400 font-bold uppercase">EXP: {product.expiryDate || 'N/A'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-6 py-4 border-r border-gray-200 text-center">
                            {product.newStockQuantity && product.newStockQuantity > 0 ? (
                              <div className="flex flex-col items-center justify-center">
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[9px] font-black h-4 px-1.5 mb-1">NEW STOCK</Badge>
                                <span className="text-sm font-black text-blue-800">{product.newStockQuantity}</span>
                                <span className="text-[9px] text-gray-400 font-bold uppercase">EXP: {product.newStockExpiry || 'N/A'}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-400 font-bold">-</span>
                            )}
                          </TableCell>
                          <TableCell className="px-6 py-4 border-r border-gray-200 text-sm">
                            <div className="flex flex-col">
                              <span className="font-bold text-green-700">₱{product.price.toFixed(2)}</span>
                              <span className="text-[10px] text-gray-400 font-bold italic">Cost: ₱{product.cost.toFixed(2)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-6 py-4 border-r border-gray-200">
                            <Badge className={`${status.color} border-none font-black text-[10px] uppercase tracking-widest leading-none`}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="px-6 py-4">
                            <div className="flex gap-2">
                              {Number(product.quantity) === 0 && (product.newStockQuantity ?? 0) > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 bg-blue-600 text-white hover:bg-blue-700 text-[10px] font-black uppercase"
                                  onClick={async () => {
                                    // Promotion logic: Move new batch to old quantity
                                    const updatedProduct = {
                                      ...product,
                                      quantity: product.newStockQuantity,
                                      expiryDate: product.newStockExpiry,
                                      newStockQuantity: 0,
                                      newStockExpiry: null
                                    };
                                    try {
                                      const res = await fetch(`/api/products.php?id=${product.id}`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json', 'X-User-Name': currentUser.name },
                                        body: JSON.stringify(updatedProduct)
                                      });
                                      if (res.ok) {
                                        toast.success('Batch rotated successfully');
                                        logAuditAction(
                                          currentUser.name,
                                          'Batch Rotation',
                                          `Promoted ${product.newStockQuantity} units for ${product.name} [SKU: ${product.sku}]`
                                        );
                                        const updatedProducts = await fetch('/api/products.php').then(r => r.json());
                                        onProductsChange(updatedProducts);
                                      }
                                    } catch (e) { toast.error('Rotation failed'); }
                                  }}
                                >
                                  Rot. Stock
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(product)} className="h-8 w-8 p-0">
                                <Edit className="size-4 text-blue-600" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteProduct(product)} className="h-8 w-8 p-0">
                                <Trash2 className="size-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredProducts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">No products found</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-b-xl">
              <div className="text-sm text-gray-500 font-medium">
                Showing <span className="text-gray-900 font-bold">{filteredProducts.length === 0 ? 0 : startIndex + 1}</span> to <span className="text-gray-900 font-bold">{Math.min(startIndex + itemsPerPage, filteredProducts.length)}</span> of <span className="text-gray-900 font-bold">{filteredProducts.length}</span> products
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
          </Card>
        </ErrorBoundary>

        {/* Edit Dialog */}
        <ErrorBoundary fallbackTitle="Edit Dialog Error">
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Product</DialogTitle>
                <DialogDescription>Update product details</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Product Name</Label>
                  <Input id="edit-name" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-sku">SKU</Label>
                  <Input id="edit-sku" value={formData.sku || ''} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <Select value={formData.category || ''} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-quantity">Quantity</Label>
                  <Input id="edit-quantity" type="number" value={formData.quantity || ''} onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-price">Selling Price (₱)</Label>
                  <Input id="edit-price" type="number" step="0.01" value={formData.price || ''} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-cost">Cost Price (₱)</Label>
                  <Input id="edit-cost" type="number" step="0.01" value={formData.cost || ''} onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-reorderLevel">Reorder Level</Label>
                  <Input id="edit-reorderLevel" type="number" value={formData.reorderLevel || ''} onChange={(e) => setFormData({ ...formData, reorderLevel: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-expiryDate">Expiry Date</Label>
                  <Input id="edit-expiryDate" type="date" value={formData.expiryDate || ''} onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })} />
                </div>
                <div className="col-span-2 p-3 bg-blue-50 border border-blue-100 rounded-lg space-y-3 my-2">
                  <h4 className="text-xs font-black text-blue-700 uppercase tracking-widest flex items-center gap-2">
                    <Plus className="size-3" /> New Stock (Rotation Support)
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-nb-qty" className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">New Stock Qty</Label>
                      <Input id="edit-nb-qty" type="number" placeholder="Optional" value={formData.newStockQuantity || ''} onChange={(e) => setFormData({ ...formData, newStockQuantity: Number(e.target.value) })} className="bg-white border-blue-200" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-nb-exp" className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">New Stock Expiry</Label>
                      <Input id="edit-nb-exp" type="date" value={formData.newStockExpiry || ''} onChange={(e) => setFormData({ ...formData, newStockExpiry: e.target.value })} className="bg-white border-blue-200" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Input id="edit-description" value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setFormData({}); setEditingProduct(null); }}>Cancel</Button>
                <Button onClick={handleEditProduct}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}
