<?php
/**
 * Plugin Name: Hoshex Prompt Automation MVP
 * Description: Authenticated, idempotent daily storage of three prompt drafts with ACF fields.
 * Version: 1.0.0
 */
if (!defined('ABSPATH')) { exit; }

final class Hoshex_Prompt_Automation_MVP {
    const FIELDS = array('prompt_text', 'language', 'sample_output', 'version', 'access_type');

    public static function boot() {
        add_action('rest_api_init', function () {
            register_rest_route('hoshex-prompts/v1', '/daily', array(
                array('methods' => 'GET', 'callback' => array(__CLASS__, 'read'), 'permission_callback' => array(__CLASS__, 'permission')),
                array('methods' => 'POST', 'callback' => array(__CLASS__, 'save'), 'permission_callback' => array(__CLASS__, 'permission')),
            ));
        });
    }

    public static function permission() {
        return current_user_can('edit_posts');
    }

    private static function day() {
        return wp_date('Y-m-d', null, new DateTimeZone('Asia/Tehran'));
    }

    private static function fields() {
        $found = array();
        if (!function_exists('acf_get_field_groups')) { return $found; }
        foreach (acf_get_field_groups(array('post_type' => 'prompts')) as $group) {
            foreach ((array) acf_get_fields($group['key']) as $field) {
                if (in_array($field['name'], self::FIELDS, true)) {
                    $found[$field['name']] = $field;
                }
            }
        }
        return $found;
    }

    private static function field_value($field, $value) {
        if (in_array($field['type'], array('select', 'radio', 'button_group'), true)) {
            if (!empty($field['multiple'])) { return new WP_Error('unsupported_multiple', $field['name']); }
            foreach ((array) $field['choices'] as $key => $label) {
                if ((string) $key === $value || (string) $label === $value) { return (string) $key; }
            }
            return new WP_Error('invalid_field_choice', $field['name']);
        }
        if (!in_array($field['type'], array('text', 'textarea', 'wysiwyg', 'number'), true)) {
            return new WP_Error('unsupported_field_type', $field['name']);
        }
        if ($field['type'] === 'number' && !is_numeric($value)) { return new WP_Error('invalid_number', $field['name']); }
        return $value;
    }

    private static function verify($id, $prompt, $fields) {
        $post = get_post($id);
        if (!$post || $post->post_type !== 'prompts' || $post->post_status !== 'draft' ||
            $post->post_title !== $prompt['title'] || $post->post_content !== $prompt['prompt']) { return false; }
        foreach (self::FIELDS as $name) {
            $value = self::field_value($fields[$name], $name === 'prompt_text' ? $prompt['prompt'] : $prompt[$name]);
            if (is_wp_error($value) || (string) get_post_meta($id, $name, true) !== (string) $value ||
                get_post_meta($id, '_' . $name, true) !== $fields[$name]['key']) { return false; }
        }
        return true;
    }

    private static function response($batch, $fields) {
        if (!$batch) { return null; }
        $complete = count($batch['post_ids']) === 3;
        foreach ($batch['prompts'] as $i => $prompt) {
            if (empty($batch['post_ids'][$i]) || !self::verify($batch['post_ids'][$i], $prompt, $fields)) { $complete = false; }
        }
        return array('status' => $complete ? 'success' : 'partial', 'count' => count($batch['post_ids']),
            'prompts' => $batch['prompts'], 'post_ids' => $batch['post_ids']);
    }

    public static function read() {
        $day = self::day();
        $fields = self::fields();
        $ready = post_type_exists('prompts') && count($fields) === 5;
        $schema = array();
        foreach ($fields as $name => $field) {
            $schema[$name] = array('type' => $field['type'], 'choices' => isset($field['choices']) ? $field['choices'] : array());
            $sample = $name === 'language' ? 'انگلیسی' : ($name === 'access_type' ? 'رایگان' : '1.0');
            if (is_wp_error(self::field_value($field, $sample))) { $ready = false; }
        }
        $previous = get_posts(array('post_type' => 'prompts', 'post_status' => array('draft', 'publish', 'pending', 'private', 'future'), 'posts_per_page' => 60));
        $batch = get_option('hxpe_batch_' . $day, null);
        return new WP_REST_Response(array('ready' => $ready, 'day' => $day, 'fields' => $schema,
            'previous_titles' => array_map(function ($p) { return $p->post_title; }, $previous),
            'batch' => $ready ? self::response($batch, $fields) : null), 200, array('Cache-Control' => 'no-store'));
    }

    private static function validate($prompts, $fields) {
        if (!is_array($prompts) || count($prompts) !== 3) { return new WP_Error('invalid_count', 'Exactly three prompts are required.', array('status' => 400)); }
        $titles = array();
        $texts = array();
        foreach ($prompts as $p) {
            foreach (array('title', 'prompt', 'language', 'sample_output', 'version', 'access_type') as $key) {
                if (!isset($p[$key]) || !is_string($p[$key]) || trim($p[$key]) === '') { return new WP_Error('invalid_fields', 'Missing prompt fields.', array('status' => 400)); }
            }
            if ($p['language'] !== 'انگلیسی' || $p['version'] !== '1.0' || $p['access_type'] !== 'رایگان' ||
                strlen($p['prompt']) < 300 || strlen($p['prompt']) > 6000 || strlen($p['title']) > 720 ||
                strlen($p['sample_output']) > 3200 || $p['prompt'] !== wp_strip_all_tags($p['prompt']) ||
                $p['title'] !== sanitize_text_field($p['title']) || in_array($p['title'], $titles, true) || in_array($p['prompt'], $texts, true)) {
                return new WP_Error('invalid_prompt', 'Invalid or duplicate prompt.', array('status' => 400));
            }
            $titles[] = $p['title']; $texts[] = $p['prompt'];
            foreach (self::FIELDS as $name) {
                if (!isset($fields[$name]) || is_wp_error(self::field_value($fields[$name], $name === 'prompt_text' ? $p['prompt'] : $p[$name]))) {
                    return new WP_Error('acf_field_not_ready', $name, array('status' => 503));
                }
            }
        }
        return true;
    }

    public static function save($request) {
        global $wpdb;
        $body = $request->get_json_params();
        $day = self::day();
        if (!is_array($body) || !isset($body['day']) || $body['day'] !== $day || !post_type_exists('prompts')) {
            return new WP_Error('invalid_day', 'Only the current Tehran day is accepted.', array('status' => 400));
        }
        $fields = self::fields();
        $valid = self::validate(isset($body['prompts']) ? $body['prompts'] : null, $fields);
        if (is_wp_error($valid)) { return $valid; }
        // The database releases this connection-scoped lock even if PHP crashes.
        $lock = 'hxpe_' . md5($wpdb->prefix . $day);
        if ((int) $wpdb->get_var($wpdb->prepare('SELECT GET_LOCK(%s, 5)', $lock)) !== 1) {
            return new WP_Error('batch_busy', 'Daily batch is being saved.', array('status' => 409));
        }
        try {
            $key = 'hxpe_batch_' . $day;
            // Refresh option cache after waiting for another request's lock.
            wp_cache_delete($key, 'options');
            wp_cache_delete('notoptions', 'options');
            $batch = get_option($key, null);
            if (!$batch) {
                $batch = array('prompts' => array_values($body['prompts']), 'post_ids' => array());
                if (!add_option($key, $batch, '', false)) { return new WP_Error('batch_storage_failed', 'Cannot reserve daily batch.', array('status' => 500)); }
            }
            $existing = self::response($batch, $fields);
            if ($existing['status'] === 'success') { return new WP_REST_Response($existing, 200, array('Cache-Control' => 'no-store')); }
            foreach ($batch['prompts'] as $i => $prompt) {
                $slug = 'hoshex-auto-' . $day . '-' . ($i + 1);
                $id = isset($batch['post_ids'][$i]) ? (int) $batch['post_ids'][$i] : 0;
                if (!$id) {
                    // Recover insertion after interruption before the ID was recorded.
                    $id = (int) $wpdb->get_var($wpdb->prepare("SELECT ID FROM {$wpdb->posts} WHERE post_type = 'prompts' AND post_name = %s ORDER BY ID ASC LIMIT 1", $slug));
                }
                if ($id) {
                    if (!self::verify($id, $prompt, $fields)) {
                        $post = get_post($id);
                        // Never overwrite an editor's changed or published draft.
                        if (!$post || $post->post_status !== 'draft' || $post->post_title !== $prompt['title'] || $post->post_content !== $prompt['prompt']) {
                            return new WP_Error('draft_changed', 'A reserved draft was changed; review it before retrying.', array('status' => 409));
                        }
                    }
                } else {
                    $id = wp_insert_post(wp_slash(array('post_type' => 'prompts', 'post_status' => 'draft', 'post_name' => $slug,
                        'post_title' => $prompt['title'], 'post_content' => $prompt['prompt'], 'post_author' => get_current_user_id())), true);
                    if (is_wp_error($id)) { return new WP_Error('post_insert_failed', 'Could not create draft.', array('status' => 500)); }
                }
                $batch['post_ids'][$i] = (int) $id;
                update_option($key, $batch, false);
                foreach (self::FIELDS as $name) {
                    $value = self::field_value($fields[$name], $name === 'prompt_text' ? $prompt['prompt'] : $prompt[$name]);
                    update_field($fields[$name]['key'], wp_slash($value), $id);
                }
                if (!self::verify($id, $prompt, $fields)) { return new WP_Error('acf_verification_failed', 'Draft fields did not persist.', array('status' => 500)); }
            }
            return new WP_REST_Response(self::response($batch, $fields), 200, array('Cache-Control' => 'no-store'));
        } finally {
            $wpdb->get_var($wpdb->prepare('SELECT RELEASE_LOCK(%s)', $lock));
        }
    }
}
Hoshex_Prompt_Automation_MVP::boot();
