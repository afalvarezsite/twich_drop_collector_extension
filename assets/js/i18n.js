const i18n = {
    lang: (navigator.language && navigator.language.toLowerCase().startsWith("es")) ? "es" : "en",
    translations: {
        en: {
            // Sidebar & Navigation
            select_game_title: "SELECT GAME",
            select_game_placeholder: "Select Game",
            search_game_placeholder: "Search Game...",
            home: "HOME",
            view_drops: "VIEW DROPS",
            auto_drops: "AUTO DROPS",
            statistics: "STATISTICS",
            settings: "SETTINGS",

            // Home Page
            not_getting_drops: "Not Currently Getting Drops",
            no_live_stream: "No live stream",
            drops_word: "drops",
            minutes_remaining: "{m} Minutes Remaining...",

            // View Drops
            view_drops_desc: "Manage drop priorities from 1 to N (1 = highest priority) and track real-time campaign progress.",
            not_currently_getting_drops_page: "Not Currently getting drops",
            priority_label: "Priority:",
            priority_single: "Priority: 1 (Max)",
            priority_max: "Max",
            priority_min: "Min",
            priority_tooltip: "Priority 1 is the highest priority",
            switch_to_drops: "Switch To Drops",
            streams_label: "Streams:",
            generic_drop: "Generic Drop",
            and_more: "and {n} more.",
            badge_completed: "Completed",
            badge_earning: "Earning",
            badge_queued: "Queued",

            // Settings
            settings_desc: "Configure extension behavior and automated drop collection options.",
            setting_connected_games: "Connected Games: When enabled, the \"select a game\" drop down will only show games that you have connected to your twitch account.",
            setting_api_token: "API Token: Automatically gets a new twitch API token when the current one expires. CAUTION: This function may tab you out of games.",
            setting_popout_window: "Pop-out Window: Watch streams in a pop-out window instead of opening a new tab.",
            setting_mute_tabs: "Mute Tabs: Automatically mute tabs opened by the extension.",
            setting_lowest_quality: "Lowest Quality: Automatically set stream video to the lowest available quality (160p) to reduce network and bandwidth usage.",
            setting_notify_badges: "Notify Badge Drops: Shows a notification if badge drops with subscriptions are available.",

            // Statistics
            stats_desc: "Overview of your claimed drops and accumulated channel points.",
            drops_claimed_init: "Drops claimed: 0",
            channel_points_init: "Channel points claimed: 0",
            drops_claimed_count: "Drops claimed: {n}",
            channel_points_count: "Channel points claimed: {n}",

            // Extension Disabled
            ext_disabled_desc: "Turn on the extension using the sidebar switch to start collecting drops.",
            ext_disabled_msg: "Extension is disabled!",

            // Auto Drops
            auto_drops_desc: "Options below will auto populate with your linked games on Twitch.",
            auto_drops_no_token: "Setting \"API Token\" has to be enabled in Settings to have access to this feature.",

            // Selector states
            signin_twitch: "Open twitch to get drops or sign in"
        },
        es: {
            // Sidebar & Navigation
            select_game_title: "SELECCIONAR JUEGO",
            select_game_placeholder: "Seleccionar juego",
            search_game_placeholder: "Buscar juego...",
            home: "INICIO",
            view_drops: "VER DROPS",
            auto_drops: "AUTO DROPS",
            statistics: "ESTADÍSTICAS",
            settings: "AJUSTES",

            // Home Page
            not_getting_drops: "No se están obteniendo drops",
            no_live_stream: "Sin directos activos",
            drops_word: "drops",
            minutes_remaining: "{m} minutos restantes...",

            // View Drops
            view_drops_desc: "Gestiona la prioridad de 1 a N (1 = máxima prioridad) y sigue el progreso en tiempo real.",
            not_currently_getting_drops_page: "No se están obteniendo drops actualmente",
            priority_label: "Prioridad:",
            priority_single: "Prioridad: 1 (Máx)",
            priority_max: "Máx",
            priority_min: "Mín",
            priority_tooltip: "La prioridad 1 es la máxima prioridad",
            switch_to_drops: "Cambiar a este drop",
            streams_label: "Directos:",
            generic_drop: "Drop genérico",
            and_more: "y {n} más.",
            badge_completed: "Completado",
            badge_earning: "Obteniendo",
            badge_queued: "En cola",

            // Settings
            settings_desc: "Configura el comportamiento y las opciones de recolección automática.",
            setting_connected_games: "Juegos conectados: Al activarse, el selector de juegos solo mostrará los juegos vinculados a tu cuenta de Twitch.",
            setting_api_token: "Token API: Obtiene automáticamente un nuevo token de la API de Twitch cuando expire. AVISO: Esta función puede sacarte de juegos.",
            setting_popout_window: "Ventana emergente: Ver directos en una ventana emergente en lugar de abrir una pestaña nueva.",
            setting_mute_tabs: "Silenciar pestañas: Silenciar automáticamente las pestañas abiertas por la extensión.",
            setting_lowest_quality: "Calidad más baja: Configura automáticamente el directo en la peor calidad posible (160p) para ahorrar datos y ancho de banda.",
            setting_notify_badges: "Notificar insignias: Muestra una notificación si hay drops de insignias con suscripciones disponibles.",

            // Statistics
            stats_desc: "Resumen de tus drops reclamados y puntos de canal acumulados.",
            drops_claimed_init: "Drops reclamados: 0",
            channel_points_init: "Puntos de canal reclamados: 0",
            drops_claimed_count: "Drops reclamados: {n}",
            channel_points_count: "Puntos de canal reclamados: {n}",

            // Extension Disabled
            ext_disabled_desc: "Activa la extensión usando el interruptor lateral para comenzar a recolectar drops.",
            ext_disabled_msg: "¡La extensión está desactivada!",

            // Auto Drops
            auto_drops_desc: "Las opciones a continuación se completarán automáticamente con tus juegos vinculados en Twitch.",
            auto_drops_no_token: "El ajuste \"Token API\" debe estar activado en Ajustes para usar esta función.",

            // Selector states
            signin_twitch: "Inicia sesión en Twitch para obtener drops"
        }
    },
    t(key, params = {}) {
        let text = this.translations[this.lang]?.[key] || this.translations["en"]?.[key] || key;
        for (const [k, v] of Object.entries(params)) {
            text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
        }
        return text;
    },
    applyStatic() {
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            el.textContent = this.t(key);
        });
        document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
            const key = el.getAttribute("data-i18n-placeholder");
            el.setAttribute("placeholder", this.t(key));
        });
        document.querySelectorAll("[data-i18n-title]").forEach(el => {
            const key = el.getAttribute("data-i18n-title");
            el.setAttribute("title", this.t(key));
        });
    }
};
