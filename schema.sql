-- ============================================================
-- schema.sql — Универсальная структура БД для экзаменационных
-- шаблонов (3NF, FK, Indexes, Demo-data)
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `exam_project`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `exam_project`;

-- 1. Пользователи
DROP TABLE IF EXISTS `requests`;
DROP TABLE IF EXISTS `services`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `reviews`;

CREATE TABLE `users` (
  `id`         INT          AUTO_INCREMENT PRIMARY KEY,
  `login`      VARCHAR(50)  NOT NULL,
  `password`   VARCHAR(255) NOT NULL COMMENT 'bcrypt hash via password_hash()',
  `role`       ENUM('client','admin') NOT NULL DEFAULT 'client',
  `fio`        VARCHAR(150) NOT NULL,
  `phone`      VARCHAR(20)  NOT NULL DEFAULT '',
  `email`      VARCHAR(100) NOT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_login` (`login`),
  UNIQUE KEY `uq_email` (`email`),
  INDEX `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Категории услуг (справочник для масштабирования)
CREATE TABLE `categories` (
  `id`          INT          AUTO_INCREMENT PRIMARY KEY,
  `name`        VARCHAR(100) NOT NULL,
  `description` TEXT         DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Услуги
CREATE TABLE `services` (
  `id`          INT            AUTO_INCREMENT PRIMARY KEY,
  `category_id` INT            NOT NULL,
  `title`       VARCHAR(150)   NOT NULL,
  `price`       DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
  INDEX `idx_category` (`category_id`),
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Заявки
CREATE TABLE `requests` (
  `id`            INT  AUTO_INCREMENT PRIMARY KEY,
  `user_id`       INT  NOT NULL,
  `service_id`    INT  NOT NULL,
  `details`       TEXT NOT NULL,
  `status`        ENUM('new','in_progress','completed','canceled')
                       NOT NULL DEFAULT 'new',
  `admin_comment` TEXT DEFAULT NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                           ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user`    (`user_id`),
  INDEX `idx_service` (`service_id`),
  INDEX `idx_status`  (`status`),
  FOREIGN KEY (`user_id`)    REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (`service_id`) REFERENCES `services`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Отзывы
CREATE TABLE `reviews` (
  `id`         INT          AUTO_INCREMENT PRIMARY KEY,
  `user_fio`   VARCHAR(150) NOT NULL,
  `rating`     INT          NOT NULL DEFAULT 5,
  `text`       TEXT         NOT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- ДЕМО-ДАННЫЕ
-- ============================================================
-- Пароли (bcrypt): admin → Admin123 | client1 → Client123
<<<<<<< HEAD
-- Данные администратора меняются в первой строке INSERT ниже:
-- login = 'admin', password = bcrypt-хеш пароля, fio/phone/email = данные админа.
=======
>>>>>>> a955f3f563dc387e0cc0a2d11eacf79ce229a404
INSERT INTO `users` (`login`,`password`,`role`,`fio`,`phone`,`email`) VALUES
('admin',   '$2y$10$f4uZ4M9M/vtPpkos2HBIhuAfhGYNZv2TvCfLBdBkFnOuqjREMKzcK',
            'admin',  'Администратор Системы','+7(999)000-00-00','admin@example.com'),
('client1', '$2y$10$V25Ktl7P2aKfc3ZfJlX0kOjboqL/gU.eRo/dXx7UU3J2LnIuvdpji',
            'client', 'Иванов Иван Иванович', '+7(999)111-22-33','ivan@example.com');

INSERT INTO `categories` (`id`,`name`,`description`) VALUES
(1, 'Ремонт компьютеров', 'Аппаратный и программный ремонт ПК и ноутбуков'),
(2, 'Установка ПО',       'Установка, настройка и лицензирование программ'),
(3, 'Настройка сетей',    'Настройка Wi-Fi, LAN, VPN');

INSERT INTO `services` (`id`,`category_id`,`title`,`price`) VALUES
(1, 1, 'Чистка от пыли и замена термопасты', 1500.00),
(2, 1, 'Замена комплектующих',               1000.00),
(3, 2, 'Установка и настройка Windows',      2500.00),
(4, 2, 'Удаление вирусов',                   1200.00),
(5, 3, 'Настройка Wi-Fi роутера',             800.00);

INSERT INTO `requests` (`user_id`,`service_id`,`details`,`status`) VALUES
(2, 3, 'Ноутбук тормозит, нужна переустановка системы.', 'new'),
(2, 1, 'Сильно греется, нужна чистка.',                  'in_progress');

INSERT INTO `reviews` (`user_fio`, `rating`, `text`) VALUES
('Александр К.', 5, 'Заказывал ремонт компьютера. Мастер приехал в тот же день, быстро нашёл неисправность и починил. Рекомендую!'),
('Елена М.', 5, 'Заказывали уборку квартиры после ремонта. Всё вымыли до блеска, пыли не осталось вообще. Буду обращаться ещё!'),
('Дмитрий С.', 5, 'Качественный сервис по настройке серверов. Всё сделали под ключ, проконсультировали по безопасности. Профессионалы!');

SET FOREIGN_KEY_CHECKS = 1;
