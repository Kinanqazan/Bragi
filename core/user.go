package core

import (
	"context"

	"github.com/deluan/rest"
	"github.com/navidrome/navidrome/model"
)

// User provides the user repository to the API layer.
type User interface {
	NewRepository(ctx context.Context) rest.Repository
}

type userService struct {
	ds model.DataStore
}

// NewUser creates a new User service
func NewUser(ds model.DataStore) User {
	return &userService{ds: ds}
}

func (s *userService) NewRepository(ctx context.Context) rest.Repository {
	return s.ds.User(ctx)
}
