-- phpMyAdmin SQL Dump
-- Database: zoe_pos_system_db

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+08:00";

CREATE DATABASE IF NOT EXISTS `pos_inventory_system_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `pos_inventory_system_db`;

-- 1. Users table (No dependencies)
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `last_login_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 1.5 Password Resets table
DROP TABLE IF EXISTS `password_resets`;
CREATE TABLE `password_resets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(100) NOT NULL,
  `token` varchar(6) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. Categories table (No dependencies)
DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3. Products table (Depends on Categories)
DROP TABLE IF EXISTS `products`;
CREATE TABLE `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sku` varchar(50) NOT NULL,
  `name` varchar(150) NOT NULL,
  `category_id` int(11) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `quantity` int(11) NOT NULL DEFAULT 0,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `cost` decimal(10,2) NOT NULL DEFAULT 0.00,
  `reorder_level` int(11) NOT NULL DEFAULT 10,
  `expiry_date` date DEFAULT NULL,
  `new_stock_quantity` int(11) NOT NULL DEFAULT 0,
  `new_stock_expiry` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `sku` (`sku`),
  KEY `category_id` (`category_id`),
  KEY `idx_products_sku` (`sku`),
  KEY `idx_products_name` (`name`),
  KEY `idx_expiry_date` (`expiry_date`),
  CONSTRAINT `products_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=156 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. Transactions table (Depends on Users)
DROP TABLE IF EXISTS `transactions`;
CREATE TABLE `transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cashier_id` int(11) DEFAULT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `payment_method` varchar(20) NOT NULL,
  `amount_received` decimal(10,2) DEFAULT NULL,
  `change_amount` decimal(10,2) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'completed',
  `transaction_date` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `cashier_id` (`cashier_id`),
  KEY `idx_transactions_date` (`transaction_date`),
  CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`cashier_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=128 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 5. Transaction Items table (Depends on Transactions and Products)
DROP TABLE IF EXISTS `transaction_items`;
CREATE TABLE `transaction_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `transaction_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `price_at_sale` decimal(10,2) NOT NULL,
  `cost_at_sale` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) GENERATED ALWAYS AS (`quantity` * `price_at_sale`) STORED,
  PRIMARY KEY (`id`),
  KEY `transaction_id` (`transaction_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `transaction_items_ibfk_1` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `transaction_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=319 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 6. Inventory Loss table (Depends on Products and Users)
DROP TABLE IF EXISTS `inventory_loss`;
CREATE TABLE `inventory_loss` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `cost_at_loss` decimal(10,2) NOT NULL,
  `reason` varchar(100) DEFAULT NULL,
  `loss_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `reported_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  KEY `reported_by` (`reported_by`),
  CONSTRAINT `inventory_loss_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_loss_ibfk_2` FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 7. Audit Logs
DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_name` varchar(100) NOT NULL,
  `action` varchar(100) NOT NULL,
  `details` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=99 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Deleted Products
DROP TABLE IF EXISTS `deleted_products`;
CREATE TABLE `deleted_products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `original_id` int(11) NOT NULL,
  `sku` varchar(100) NOT NULL,
  `name` varchar(255) NOT NULL,
  `category` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `quantity` int(11) DEFAULT 0,
  `price` decimal(10,2) DEFAULT 0.00,
  `cost` decimal(10,2) DEFAULT 0.00,
  `reorder_level` int(11) DEFAULT 0,
  `expiry_date` date DEFAULT NULL,
  `deleted_by` varchar(100) DEFAULT NULL,
  `deleted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Error Logs
DROP TABLE IF EXISTS `error_logs`;
CREATE TABLE `error_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `source` varchar(20) NOT NULL DEFAULT 'php' COMMENT 'php | javascript',
  `level` varchar(20) NOT NULL DEFAULT 'error' COMMENT 'error | warning | notice | unhandled_rejection',
  `message` text NOT NULL,
  `file` varchar(500) DEFAULT NULL,
  `line` int(11) DEFAULT NULL,
  `stack_trace` text DEFAULT NULL,
  `url` varchar(1000) DEFAULT NULL,
  `user_name` varchar(100) DEFAULT NULL,
  `extra` text DEFAULT NULL COMMENT 'JSON blob of any extra context',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_source` (`source`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. User Activity Logs
DROP TABLE IF EXISTS `user_activity_logs`;
CREATE TABLE `user_activity_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(255) NOT NULL,
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `user_activity_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Views
DROP VIEW IF EXISTS `view_daily_sales_profit`;
CREATE VIEW `view_daily_sales_profit` AS select cast(`t`.`transaction_date` as date) AS `sale_date`,count(`t`.`id`) AS `total_transactions`,sum(`t`.`total_amount`) AS `gross_revenue`,sum(`ti`.`quantity` * `ti`.`cost_at_sale`) AS `total_cost`,sum(`t`.`total_amount`) - sum(`ti`.`quantity` * `ti`.`cost_at_sale`) AS `gross_profit` from (`transactions` `t` join `transaction_items` `ti` on(`t`.`id` = `ti`.`transaction_id`)) group by cast(`t`.`transaction_date` as date);

DROP VIEW IF EXISTS `view_product_performance`;
CREATE VIEW `view_product_performance` AS select `p`.`id` AS `id`,`p`.`name` AS `name`,`c`.`name` AS `category_name`,sum(`ti`.`quantity`) AS `total_sold`,sum(`ti`.`subtotal`) AS `total_revenue` from ((`products` `p` left join `transaction_items` `ti` on(`p`.`id` = `ti`.`product_id`)) left join `categories` `c` on(`p`.`category_id` = `c`.`id`)) group by `p`.`id`,`p`.`name`,`c`.`name` order by sum(`ti`.`quantity`) desc;

DROP VIEW IF EXISTS `view_stock_status`;
CREATE VIEW `view_stock_status` AS select `products`.`id` AS `id`,`products`.`sku` AS `sku`,`products`.`name` AS `name`,`products`.`quantity` AS `quantity`,`products`.`reorder_level` AS `reorder_level`,case when `products`.`quantity` = 0 then 'Out of Stock' when `products`.`quantity` <= `products`.`reorder_level` then 'Low Stock' else 'In Stock' end AS `status` from `products`;

-- Initial DATA for setup
INSERT INTO `users` (`username`, `password_hash`, `full_name`, `email`) VALUES
('owner', '$2y$12$.d/VfW05ikLAmKVA4YalYO3jNJE7ZP1xkfjt8UoiIWsxJ0Thu6Oqu', 'Zoe Owner', 'owner@zoepharmacy.com'),
('admin', '$2y$12$Trff1mtH5AkDfBflq5Jwru9OolDsnpq.Xj.w0zOdHJt2r6eB0jp4W', 'Zoe Admin', 'admin@zoepharmacy.com');

INSERT INTO `categories` (`name`, `description`) VALUES
('Pharmaceutical', 'Medicines and drugs'),
('Non-pharmaceutical', 'General merchandise and equipment');

COMMIT;
