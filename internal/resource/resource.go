// Package resource provides a thin service layer over the SandBase REST API's
// CRUD-style resource endpoints (agents, environments, sessions, skills, ...).
//
// It encapsulates endpoint/method mapping so command handlers stay free of
// transport details, keeping the four-layer architecture intact: commands call
// resource.Service, which calls client.ApiClient.
package resource

import (
	"context"
	"fmt"
	"net/http"
	"net/url"

	"github.com/sandbaseai/cli/internal/client"
)

// Service maps high-level resource operations to HTTP calls.
type Service struct {
	Client *client.ApiClient
}

// New creates a resource Service backed by the given API client.
func New(c *client.ApiClient) *Service {
	return &Service{Client: c}
}

// base builds "/v1/{resourcePath}".
func base(resourcePath string) string {
	return "/v1/" + resourcePath
}

// item builds "/v1/{resourcePath}/{id}" with id escaped.
func item(resourcePath, id string) string {
	return fmt.Sprintf("/v1/%s/%s", resourcePath, url.PathEscape(id))
}

// List performs GET /v1/{resourcePath}. Optional query params may be supplied.
func (s *Service) List(ctx context.Context, resourcePath string, query url.Values) (map[string]any, error) {
	path := base(resourcePath)
	if len(query) > 0 {
		path += "?" + query.Encode()
	}
	var result map[string]any
	if err := s.Client.Request(ctx, http.MethodGet, path, nil, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// Get performs GET /v1/{resourcePath}/{id}.
func (s *Service) Get(ctx context.Context, resourcePath, id string) (map[string]any, error) {
	var result map[string]any
	if err := s.Client.Request(ctx, http.MethodGet, item(resourcePath, id), nil, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// Create performs POST /v1/{resourcePath}.
func (s *Service) Create(ctx context.Context, resourcePath string, body map[string]any) (map[string]any, error) {
	var result map[string]any
	if err := s.Client.Request(ctx, http.MethodPost, base(resourcePath), body, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// Update performs PATCH /v1/{resourcePath}/{id}.
func (s *Service) Update(ctx context.Context, resourcePath, id string, body map[string]any) (map[string]any, error) {
	var result map[string]any
	if err := s.Client.Request(ctx, http.MethodPatch, item(resourcePath, id), body, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// Delete performs DELETE /v1/{resourcePath}/{id}.
func (s *Service) Delete(ctx context.Context, resourcePath, id string) error {
	return s.Client.Request(ctx, http.MethodDelete, item(resourcePath, id), nil, nil)
}

// Action performs POST /v1/{resourcePath}/{id}/{action}.
func (s *Service) Action(ctx context.Context, resourcePath, id, action string, body map[string]any) (map[string]any, error) {
	path := fmt.Sprintf("/v1/%s/%s/%s", resourcePath, url.PathEscape(id), action)
	var result map[string]any
	if err := s.Client.Request(ctx, http.MethodPost, path, body, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// SubList performs GET /v1/{resourcePath}/{id}/{sub}.
func (s *Service) SubList(ctx context.Context, resourcePath, id, sub string) (map[string]any, error) {
	path := fmt.Sprintf("/v1/%s/%s/%s", resourcePath, url.PathEscape(id), sub)
	var result map[string]any
	if err := s.Client.Request(ctx, http.MethodGet, path, nil, &result); err != nil {
		return nil, err
	}
	return result, nil
}
