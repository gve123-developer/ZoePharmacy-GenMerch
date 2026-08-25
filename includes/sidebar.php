<?php
$current_page = basename($_SERVER['PHP_SELF']);
// Read logged-in user info from session
$_session_full_name = $_SESSION['full_name'] ?? ($_SESSION['username'] ?? 'User');
$_session_role      = 'admin';
?>

<!-- Header from App.tsx equivalent -->
<header class="border-b border-gray-200 sticky top-0 z-10 flex-shrink-0" style="background-color: #d5ff47;">
    <div class="px-6 py-4">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
                <button
                    class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-black/5 hover:text-accent-foreground h-10 w-10"
                >
                    <span class="material-icons">menu</span>
                </button>
                <div>
                    <h1 class="font-semibold text-xl text-gray-900 uppercase">Zoe Pharmacy & General Merchandise</h1>
                    <p class="text-sm text-gray-500">Inventory & POS System</p>
                </div>
            </div>
            <div class="flex items-center gap-4">
                <div class="text-right">
                    <p class="font-bold text-lg text-gray-900 leading-tight"><?= htmlspecialchars($_session_full_name) ?></p>
                    <p class="text-sm font-semibold text-gray-600 capitalize tracking-wide"><?= $_session_role ?></p>
                </div>
            </div>
        </div>
    </div>
</header>

<div class="flex flex-1 overflow-hidden relative">
    <!-- Sidebar from App.tsx equivalent -->
    <aside
        class="border-r border-gray-200 overflow-y-auto transition-all duration-300 ease-in-out w-60 translate-x-0 opacity-100"
        style="background-color: #f1fec1;"
    >
        <nav class="p-4 h-full flex flex-col">
            <div class="space-y-1">
                <a href="index.php" class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all duration-200 <?php echo $current_page == 'index.php' ? 'text-gray-900 border-l-4 border-gray-800 shadow-md' : 'text-gray-700 hover:bg-gray-50 hover:-translate-y-0.5 active:-translate-y-1'; ?>" <?php echo $current_page == 'index.php' ? 'style="background-color: #d5ff47;"' : ''; ?>>
                    <span class="material-icons text-[18px]">dashboard</span>
                    Dashboard
                </a>

                <a href="pos.php" class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all duration-200 <?php echo $current_page == 'pos.php' ? 'text-gray-900 border-l-4 border-gray-800 shadow-md' : 'text-gray-700 hover:bg-gray-50 hover:-translate-y-0.5 active:-translate-y-1'; ?>" <?php echo $current_page == 'pos.php' ? 'style="background-color: #d5ff47;"' : ''; ?>>
                    <span class="material-icons text-[18px]">shopping_cart</span>
                    Point of Sale
                </a>

                <a href="inventory.php" class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all duration-200 <?php echo $current_page == 'inventory.php' ? 'text-gray-900 border-l-4 border-gray-800 shadow-md' : 'text-gray-700 hover:bg-gray-50 hover:-translate-y-0.5 active:-translate-y-1'; ?>" <?php echo $current_page == 'inventory.php' ? 'style="background-color: #d5ff47;"' : ''; ?>>
                    <span class="material-icons text-[18px]">inventory_2</span>
                    Inventory
                </a>

                <a href="transactions.php" class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all duration-200 <?php echo $current_page == 'transactions.php' ? 'text-gray-900 border-l-4 border-gray-800 shadow-md' : 'text-gray-700 hover:bg-gray-50 hover:-translate-y-0.5 active:-translate-y-1'; ?>" <?php echo $current_page == 'transactions.php' ? 'style="background-color: #d5ff47;"' : ''; ?>>
                    <span class="material-icons text-[18px]">receipt_long</span>
                    Transactions
                </a>

                <a href="reports.php" class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all duration-200 <?php echo $current_page == 'reports.php' ? 'text-gray-900 border-l-4 border-gray-800 shadow-md' : 'text-gray-700 hover:bg-gray-50 hover:-translate-y-0.5 active:-translate-y-1'; ?>" <?php echo $current_page == 'reports.php' ? 'style="background-color: #d5ff47;"' : ''; ?>>
                    <span class="material-icons text-[18px]">bar_chart</span>
                    Reports
                </a>
            </div>

            <div class="mt-auto pt-4 border-t border-black/5 space-y-1">
                <a href="users.php" class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-base font-semibold transition-all duration-200 <?php echo $current_page == 'users.php' ? 'text-gray-900 border-l-4 border-gray-800 shadow-md' : 'text-gray-700 hover:bg-gray-50 hover:-translate-y-0.5 active:-translate-y-1'; ?>" <?php echo $current_page == 'users.php' ? 'style="background-color: #d5ff47;"' : ''; ?>>
                    <span class="material-icons text-[18px]">group</span>
                    User Management
                </a>

                <a href="login.php" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-semibold text-red-600 hover:bg-red-50 transition-all duration-150 hover:-translate-y-0.5 active:-translate-y-1">
                    <span class="material-icons text-[18px]">logout</span>
                    Logout
                </a>
            </div>
        </nav>
    </aside>
