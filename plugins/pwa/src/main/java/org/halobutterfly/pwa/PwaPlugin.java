package org.halobutterfly.pwa;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.RouterFunctions;
import org.springframework.web.reactive.function.server.ServerResponse;
import org.thymeleaf.context.ITemplateContext;
import org.thymeleaf.model.IModel;
import org.thymeleaf.model.AttributeValueQuotes;
import org.thymeleaf.processor.element.IElementModelStructureHandler;
import reactor.core.publisher.Mono;
import run.halo.app.plugin.BasePlugin;
import run.halo.app.plugin.PluginContext;
import run.halo.app.plugin.ReactiveSettingFetcher;
import run.halo.app.theme.dialect.TemplateHeadProcessor;

/** Only application metadata and a public offline document; no content/user API access. */
@Configuration(proxyBeanMethods = false)
public class PwaPlugin extends BasePlugin implements TemplateHeadProcessor {
    private static final String BASE = "/butterfly-pwa/";
    private final ReactiveSettingFetcher settings;

    public record Preferences(Boolean enabled, String name, String shortName,
                              String icon192, String icon512, String themeColor) {
        boolean active() { return Boolean.TRUE.equals(enabled); }
    }

    public PwaPlugin(PluginContext context, ReactiveSettingFetcher settings) {
        super(context);
        this.settings = settings;
    }

    private Mono<Preferences> preferences() {
        return settings.fetch("basic", Preferences.class)
            .defaultIfEmpty(new Preferences(false, null, null, null, null, null));
    }

    private static String text(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.strip();
    }

    private static String icon(String value, int size) {
        if (value != null && !value.contains("\\") &&
            ((value.startsWith("/") && !value.startsWith("//")) || value.startsWith("https://"))) {
            return value;
        }
        return BASE + "icon-" + size + ".png";
    }

    private static String color(Preferences p) {
        return p.themeColor() != null && p.themeColor().matches("#[0-9a-fA-F]{6}")
            ? p.themeColor() : "#185d85";
    }

    private Mono<ServerResponse> manifest() {
        return preferences().flatMap(p -> {
            if (!p.active()) return ServerResponse.notFound().build();
            return ServerResponse.ok().contentType(MediaType.parseMediaType("application/manifest+json"))
                .header("Cache-Control", "no-store")
                .bodyValue(Map.of("id", "/", "name", text(p.name(), "我的博客"),
                    "short_name", text(p.shortName(), "博客"), "start_url", "/", "scope", "/",
                    "display", "standalone", "background_color", "#f7f9fe", "theme_color", color(p),
                    "icons", List.of(
                        Map.of("src", icon(p.icon192(), 192), "sizes", "192x192", "type", "image/png", "purpose", "any"),
                        Map.of("src", icon(p.icon512(), 512), "sizes", "512x512", "type", "image/png", "purpose", "any"))));
        });
    }

    private static byte[] resource(String name) {
        try (var input = PwaPlugin.class.getResourceAsStream("/pwa/" + name)) {
            if (input == null) throw new IllegalStateException("Missing packaged PWA resource: " + name);
            return input.readAllBytes();
        } catch (IOException error) { throw new IllegalStateException(error); }
    }

    private Mono<ServerResponse> asset(String name, String type, boolean worker) {
        var response = ServerResponse.ok().contentType(MediaType.parseMediaType(type))
            .header("Cache-Control", "no-store")
            .header("X-Content-Type-Options", "nosniff");
        if (worker) response.header("Service-Worker-Allowed", "/");
        return response.bodyValue(resource(name));
    }

    @Bean
    RouterFunction<ServerResponse> butterflyPwaRoutes() {
        return RouterFunctions.route()
            .GET(BASE + "manifest.webmanifest", request -> manifest())
            .GET(BASE + "status", request -> preferences().flatMap(p -> ServerResponse.ok()
                .header("Cache-Control", "no-store").bodyValue(Map.of("owner", "butterfly-pwa", "enabled", p.active()))))
            .GET(BASE + "sw.js", request -> asset("sw.js", "text/javascript; charset=UTF-8", true))
            .GET(BASE + "offline.html", request -> asset("offline.html", "text/html; charset=UTF-8", false))
            .GET(BASE + "icon-192.png", request -> asset("icon-192.png", "image/png", false))
            .GET(BASE + "icon-512.png", request -> asset("icon-512.png", "image/png", false))
            .build();
    }

    @Override
    public Mono<Void> process(ITemplateContext context, IModel model,
                             IElementModelStructureHandler handler) {
        return preferences().doOnNext(p -> {
            if (!p.active()) return;
            var factory = context.getModelFactory();
            model.add(factory.createStandaloneElementTag("link", Map.of("rel", "manifest",
                "href", BASE + "manifest.webmanifest", "data-butterfly-pwa", ""),
                AttributeValueQuotes.DOUBLE, false, true));
            model.add(factory.createStandaloneElementTag("link", Map.of("rel", "apple-touch-icon",
                "href", icon(p.icon192(), 192)), AttributeValueQuotes.DOUBLE, false, true));
            model.add(factory.createStandaloneElementTag("meta", Map.of("name", "theme-color",
                "content", color(p)), AttributeValueQuotes.DOUBLE, false, true));
        }).then();
    }
}
