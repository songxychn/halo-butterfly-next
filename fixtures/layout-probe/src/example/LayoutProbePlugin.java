package example;

import java.util.Map;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.RouterFunctions;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;
import run.halo.app.plugin.BasePlugin;
import run.halo.app.plugin.PluginContext;
import run.halo.app.theme.TemplateNameResolver;
import run.halo.app.theme.router.ModelConst;

/** 仅供独立本地测试站使用，不读取文章、配置或用户数据。 */
@Configuration(proxyBeanMethods = false)
public class LayoutProbePlugin extends BasePlugin {
    private final TemplateNameResolver templates;

    public LayoutProbePlugin(PluginContext context, TemplateNameResolver templates) {
        super(context);
        this.templates = templates;
    }

    @Bean
    RouterFunction<ServerResponse> layoutProbeRoutes() {
        return RouterFunctions.route()
            .GET("/__layout-probe/head", request -> render(request, "layout-probe-head"))
            .GET("/__layout-probe/no-head", request -> render(request, "layout-probe-no-head"))
            .build();
    }

    private Mono<ServerResponse> render(ServerRequest request, String template) {
        String expected = "plugin:" + getContext().getName() + ":" + template;
        return templates.resolveTemplateNameOrDefault(request.exchange(), template)
            .flatMap(resolved -> {
                // 主题覆盖同名模板会破坏夹具隔离，不能将其记作插件自有模板验收。
                if (!expected.equals(resolved)) {
                    return ServerResponse.status(500)
                        .bodyValue("Layout probe requires its own plugin template");
                }
                return ServerResponse.ok()
                    .contentType(MediaType.TEXT_HTML)
                    .header("X-Layout-Probe-Template", expected)
                    .render(resolved, Map.of(ModelConst.TEMPLATE_ID, expected));
            });
    }
}
