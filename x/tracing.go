package x

import (
	"context"
	"net/http"

	"github.com/julienschmidt/httprouter"
	"go.opentelemetry.io/otel"
	semconv "go.opentelemetry.io/otel/semconv/v1.7.0"
	"go.opentelemetry.io/otel/trace"
)

func WrapHTTPRouter(h httprouter.Handle) httprouter.Handle {
	return func(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
		opts := append([]trace.SpanStartOption{
			trace.WithAttributes(semconv.NetAttributesFromHTTPRequest("tcp", r)...),
			trace.WithAttributes(semconv.EndUserAttributesFromHTTPRequest(r)...),
			trace.WithAttributes(semconv.HTTPServerAttributesFromHTTPRequest(r.URL.Path, "", r)...),
		})

		ctx := r.Context()
		ctx = context.WithValue(ctx, "params", ps)

		tracer := otel.GetTracerProvider().Tracer("github.com/ory/kratos")
		ctx, span := tracer.Start(r.Context(), r.URL.Path, opts...)
		defer span.End()

		r = r.WithContext(ctx)
		h(w, r, ps)
	}
}
