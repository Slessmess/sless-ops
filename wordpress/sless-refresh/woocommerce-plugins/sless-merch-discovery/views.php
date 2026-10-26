<?php
/**
 * Sless Merch Discovery - render helpers. All functions return strings.
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }

if ( ! function_exists( 'sm_logo_url' ) ) {
	function sm_logo_url() {
		return 'https://slessismore.org/wp-content/uploads/2024/10/trainwithsless-01-1.png';
	}
}

if ( ! function_exists( 'sm_safe_categories' ) ) {
	/** Categories from sm_categories(), filtered to non-empty, excluding Uncategorized. */
	function sm_safe_categories() {
		if ( ! function_exists( 'sm_categories' ) ) { return array(); }
		$out = array();
		foreach ( (array) sm_categories() as $c ) {
			$c = (array) $c;
			if ( empty( $c['slug'] ) || 'uncategorized' === $c['slug'] || empty( $c['url'] ) ) { continue; }
			$out[] = array(
				'name'  => isset( $c['name'] ) ? (string) $c['name'] : $c['slug'],
				'slug'  => (string) $c['slug'],
				'url'   => (string) $c['url'],
				'count' => isset( $c['count'] ) ? (int) $c['count'] : 0,
				'group' => ( isset( $c['group'] ) && 'collection' === $c['group'] ) ? 'collection' : 'type',
			);
		}
		return $out;
	}
}

if ( ! function_exists( 'sm_nav_render' ) ) {
	function sm_nav_render() {
		$shop    = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : home_url( '/shop/' );
		$account = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'myaccount' ) : home_url( '/my-account/' );
		$cart    = function_exists( 'wc_get_cart_url' ) ? wc_get_cart_url() : home_url( '/cart/' );
		$cats    = sm_safe_categories();
		$groups  = array( 'collection' => array(), 'type' => array() );
		foreach ( $cats as $c ) { $groups[ $c['group'] ][] = $c; }

		$is_shop = function_exists( 'is_woocommerce' ) && ( is_woocommerce() || is_cart() || is_checkout() );
		$cur = function ( $cond ) { return $cond ? ' aria-current="page"' : ''; };

		$sub = '';
		$labels = array( 'collection' => 'Collections', 'type' => 'Shop by type' );
		foreach ( $groups as $g => $items ) {
			if ( ! $items ) { continue; }
			$sub .= '<div class="sm-sub-group"><p class="sm-sub-label">' . esc_html( $labels[ $g ] ) . '</p><ul>';
			foreach ( $items as $c ) {
				$sub .= '<li><a href="' . esc_url( $c['url'] ) . '"><span>' . esc_html( $c['name'] ) . '</span>'
					. ( $c['count'] > 0 ? '<span class="sm-count" aria-label="' . esc_attr( sprintf( '%d products', $c['count'] ) ) . '">' . (int) $c['count'] . '</span>' : '' )
					. '</a></li>';
			}
			$sub .= '</ul></div>';
		}
		$sub .= '<a class="sm-sub-all" href="' . esc_url( $shop ) . '">All merch</a>';

		ob_start(); ?>
<header id="sless-site-header" class="sm-header" data-sm-header>
<a class="sm-skip" href="#sm-main-content">Skip to content</a>
	<div class="sm-header-inner">
		<a class="sm-brand" href="<?php echo esc_url( home_url( '/' ) ); ?>" aria-label="Sless Is More home">
			<img src="<?php echo esc_url( sm_logo_url() ); ?>" alt="Sless Is More" width="104" height="60">
		</a>
<a class="sm-mobile-cart" href="<?php echo esc_url( $cart ); ?>">Cart</a>
		<button type="button" class="sm-burger" aria-expanded="false" aria-controls="sm-primary" data-sm-burger>
			<span class="sm-burger-bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="sm-burger-text">Menu</span>
		</button>
		<nav id="sm-primary" class="sm-primary" aria-label="Main navigation" data-sm-panel>
			<ul class="sm-menu">
				<li><a class="sm-link" href="<?php echo esc_url( home_url( '/' ) ); ?>"<?php echo $cur( is_front_page() ); ?>>Home</a></li>
				<li><a class="sm-link" href="<?php echo esc_url( home_url( '/wrestling/' ) ); ?>"<?php echo $cur( is_page( 'wrestling' ) ); ?>>Wrestling</a></li>
				<li><a class="sm-link" href="<?php echo esc_url( home_url( '/ai/' ) ); ?>"<?php echo $cur( is_page( 'ai' ) ); ?>>SlessBox AI</a></li>
				<li class="sm-has-sub" data-sm-dropdown>
					<div class="sm-split">
						<a class="sm-link sm-link-shop" href="<?php echo esc_url( $shop ); ?>"<?php echo $is_shop ? ' aria-current="page"' : ''; ?>>Shop Merch</a>
						<button type="button" class="sm-sub-toggle" aria-expanded="false" aria-controls="sm-shop-sub" data-sm-sub-toggle>
							<span class="sm-visually-hidden">Show merch categories</span><svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2"/></svg>
						</button>
					</div>
					<div id="sm-shop-sub" class="sm-sub" hidden data-sm-sub><?php echo $sub; // escaped above ?></div>
				</li>
				<li><a class="sm-link" href="<?php echo esc_url( home_url( '/giveaway/' ) ); ?>"<?php echo $cur( is_page( 'giveaway' ) ); ?>>Giveaway</a></li>
			</ul>
			<ul class="sm-utility">
				<li><a class="sm-util" href="<?php echo esc_url( $account ); ?>"<?php echo $cur( function_exists( 'is_account_page' ) && is_account_page() ); ?>>Account</a></li>
				<li><a class="sm-util sm-cart" href="<?php echo esc_url( $cart ); ?>"<?php echo $cur( function_exists( 'is_cart' ) && is_cart() ); ?>>
					<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path d="M3 4h3l2.4 11h10.2L21 7H7" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="10" cy="20" r="1.6" fill="currentColor"/><circle cx="18" cy="20" r="1.6" fill="currentColor"/></svg>Cart</a></li>
			</ul>
		</nav>
	</div>
</header>
<div id="sm-main-content" tabindex="-1"></div>
		<?php
		return (string) ob_get_clean();
	}
}

if ( ! function_exists( 'sm_feature_product' ) ) {
	function sm_feature_product( $id ) {
		if ( ! function_exists( 'wc_get_product' ) ) { return null; }
		$p = wc_get_product( $id );
		if ( ! $p || 'publish' !== $p->get_status() || ! $p->is_visible() ) { return null; }
		return $p;
	}
}

if ( ! function_exists( 'sm_halloween_render' ) ) {
	function sm_halloween_render() {
		$items = array(
			660 => array(
				'tag'   => 'The tee',
				'specs' => array( 'Colors: purple, orange, black', 'Sizes: S, M, L, XL, 2XL, 3XL' ),
				'cta'   => 'Pick color + size',
			),
			680 => array(
				'tag'   => 'The original canvas',
				'specs' => array( 'Original artwork', 'Exactly 6 × 6 inches' ),
				'cta'   => 'View the canvas',
			),
		);
		$cards = '';
		$n = 0;
		foreach ( $items as $id => $meta ) {
			$p = sm_feature_product( $id );
			if ( ! $p ) { continue; }
			$n++;
			$img_id = $p->get_image_id();
			$img = $img_id
				? wp_get_attachment_image( $img_id, 'woocommerce_single', false, array( 'class' => 'sm-hw-img', 'loading' => 'lazy', 'alt' => esc_attr( $p->get_name() ) ) )
				: wc_placeholder_img( 'woocommerce_single', array( 'class' => 'sm-hw-img' ) );
			$specs = '';
			foreach ( $meta['specs'] as $s ) { $specs .= '<li>' . esc_html( $s ) . '</li>'; }
			$link = esc_url( $p->get_permalink() );
			$cards .= '<article class="sm-hw-card sm-hw-card-' . (int) $id . '">'
				. '<a class="sm-hw-media" href="' . $link . '" tabindex="-1" aria-hidden="true">' . $img . '<span class="sm-hw-num" aria-hidden="true">0' . $n . '</span></a>'
				. '<div class="sm-hw-body"><p class="sm-hw-tag">' . esc_html( $meta['tag'] ) . '</p>'
				. '<h3 class="sm-hw-name"><a href="' . $link . '">' . esc_html( $p->get_name() ) . '</a></h3>'
				. '<ul class="sm-hw-specs">' . $specs . '</ul>'
				. '<div class="sm-hw-foot"><span class="sm-hw-price">' . wp_kses_post( $p->get_price_html() ) . '</span>'
				. '<a class="sm-btn" href="' . $link . '">' . esc_html( $meta['cta'] ) . '</a></div></div></article>';
		}
		if ( ! $cards ) { return ''; }

		$hw_url = '';
		$shop = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : home_url( '/shop/' );
		foreach ( sm_safe_categories() as $c ) { if ( 'halloween' === $c['slug'] ) { $hw_url = $c['url']; } }
		if ( ! $hw_url ) { $hw_url = $shop; }

		return '<section id="sless-halloween-feature" class="sm-hw" aria-labelledby="sm-hw-title">'
			. '<div class="sm-hw-inner">'
			. '<div class="sm-hw-head"><div><p class="sm-eyebrow">New in the store · Halloween</p>'
			. '<h2 id="sm-hw-title" class="sm-hw-title">Sless <span>After Dark</span></h2></div>'
. '<div class="sm-hw-intro"><p>Sless Taylor’s Halloween design, on a tee or the original square canvas. Made to order; shipping calculated at checkout.</p>'
			. '<div class="sm-hw-links"><a class="sm-btn sm-btn-ghost" href="' . esc_url( $hw_url ) . '">Shop Halloween</a>'
			. '<a class="sm-arrow" href="' . esc_url( $shop ) . '">All merch</a></div></div></div>'
			. '<div class="sm-hw-grid">' . $cards . '</div>'
			. '</div></section>';
	}
}

if ( ! function_exists( 'sm_catalog_render' ) ) {
	function sm_catalog_render() {
$q   = isset( $_GET['s'] ) && is_string( $_GET['s'] ) ? sanitize_text_field( wp_unslash( $_GET['s'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
$sel = isset( $_GET['product_cat'] ) && is_string( $_GET['product_cat'] ) ? sanitize_title( wp_unslash( $_GET['product_cat'] ) ) : ''; // phpcs:ignore
		if ( ! $sel && function_exists( 'is_product_category' ) && is_product_category() ) {
			$t = get_queried_object();
			if ( $t && isset( $t->slug ) ) { $sel = $t->slug; }
		}
		$cats = sm_safe_categories();
		$shop = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : home_url( '/shop/' );
		$all_active = ! $sel && ! $q && function_exists( 'is_shop' ) && is_shop();

		$opts = '<option value="">All categories</option>';
		$chips = '<li><a class="sm-chip"' . ( $all_active ? ' aria-current="page"' : '' ) . ' href="' . esc_url( $shop ) . '">All merch</a></li>';
		foreach ( $cats as $c ) {
			$opts .= '<option value="' . esc_attr( $c['slug'] ) . '"' . selected( $sel, $c['slug'], false ) . '>' . esc_html( $c['name'] ) . '</option>';
			$active = $sel === $c['slug'];
			$chips .= '<li><a class="sm-chip sm-chip-' . esc_attr( $c['group'] ) . '"' . ( $active ? ' aria-current="page"' : '' ) . ' href="' . esc_url( $c['url'] ) . '">'
				. esc_html( $c['name'] ) . ( $c['count'] > 0 ? ' <span class="sm-count">' . (int) $c['count'] . '</span>' : '' ) . '</a></li>';
		}

		$status = '';
		if ( '' !== $q ) {
			$status = '<p class="sm-cat-status" role="status">Results for <strong>&ldquo;' . esc_html( $q ) . '&rdquo;</strong>. <a href="' . esc_url( $shop ) . '">Clear search</a></p>';
		}

		return '<div class="sm-catalog" id="sm-catalog">'
			. '<form class="sm-search" role="search" method="get" action="' . esc_url( home_url( '/' ) ) . '">'
			. '<input type="hidden" name="post_type" value="product">'
			. '<div class="sm-field sm-field-q"><label for="sm-q">Search merch</label>'
			. '<input id="sm-q" type="search" name="s" value="' . esc_attr( $q ) . '" placeholder="Tee, canvas, phone case..." autocomplete="off"></div>'
			. '<div class="sm-field sm-field-cat"><label for="sm-cat">Category</label><select id="sm-cat" name="product_cat">' . $opts . '</select></div>'
			. '<button class="sm-btn sm-search-btn" type="submit">Search</button></form>'
			. $status
			. '<nav class="sm-chips-nav" aria-label="Merch categories"><ul class="sm-chips">' . $chips . '</ul></nav>'
			. '</div>';
	}
}
