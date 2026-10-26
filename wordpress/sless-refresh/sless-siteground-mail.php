<?php
/**
 * Plugin Name: Sless SiteGround Transactional Mail
 * Description: Authenticated TLS mail; credentials live outside the public web root.
 */
defined('ABSPATH') || exit;

function sless_siteground_mail_config() {
    $path = dirname(rtrim(ABSPATH, '/')) . '/.sless-private/mail.php';
    if (!is_readable($path)) {
        throw new RuntimeException('Sless authenticated email configuration is unavailable.');
    }
    $config = require $path;
    if (!is_array($config) || empty($config['host']) || empty($config['password'])
        || empty($config['username']) || !is_email($config['username'])) {
        throw new RuntimeException('Sless authenticated email configuration is invalid.');
    }
    return $config;
}

add_action('phpmailer_init', function ($mailer) {
    $config = sless_siteground_mail_config();
    $mailer->isSMTP();
    $mailer->Host = $config['host'];
    $mailer->Port = 587;
    $mailer->SMTPSecure = 'tls';
    $mailer->SMTPAuth = true;
    $mailer->SMTPAutoTLS = true;
    $mailer->Username = $config['username'];
    $mailer->Password = $config['password'];
    $mailer->SMTPDebug = 0;
    $mailer->SMTPOptions = array('ssl' => array(
        'verify_peer' => true,
        'verify_peer_name' => true,
        'allow_self_signed' => false,
    ));
    $mailer->Timeout = 30;
    $mailer->setFrom($config['username'], 'Sless Is More', false);
    $mailer->Sender = $config['username'];
}, PHP_INT_MAX);
