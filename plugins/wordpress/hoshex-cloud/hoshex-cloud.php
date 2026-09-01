<?php
/**
 * Plugin Name: Hoshex Cloud
 * Description: نمایش مسیر فعال هوشکس داخل وردپرس با اتصال به Hoshex Cloud.
 * Version: 0.1.0
 * Author: Hoshex
 */

if (!defined('ABSPATH')) { exit; }

function hoshex_cloud_enqueue_widget() {
    wp_enqueue_script(
        'hoshex-cloud-widget',
        'https://hoshex-app.vercel.app/assets/hoshex-cloud-widget.js',
        array(),
        '0.1.0',
        true
    );
}
add_action('wp_enqueue_scripts', 'hoshex_cloud_enqueue_widget');

function hoshex_cloud_shortcode($atts = array()) {
    $atts = shortcode_atts(array(
        'title' => 'مسیر کسب‌وکار من'
    ), $atts, 'hoshex_business_path');

    return '<div data-hoshex-cloud-widget data-title="' . esc_attr($atts['title']) . '"></div>';
}
add_shortcode('hoshex_business_path', 'hoshex_cloud_shortcode');

function hoshex_cloud_block_assets() {
    if (!function_exists('register_block_type')) { return; }
    register_block_type('hoshex/cloud-path', array(
        'render_callback' => function () {
            return '<div data-hoshex-cloud-widget></div>';
        }
    ));
}
add_action('init', 'hoshex_cloud_block_assets');
