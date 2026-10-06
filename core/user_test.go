package core_test

import (
	"context"
	"errors"

	"github.com/deluan/rest"
	"github.com/kinanqaz/bragi/core"
	"github.com/kinanqaz/bragi/model"
	"github.com/kinanqaz/bragi/tests"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("User Service", func() {
	var service core.User
	var ds *tests.MockDataStore
	var userRepo *tests.MockedUserRepo
	var ctx context.Context

	BeforeEach(func() {
		ds = &tests.MockDataStore{}
		userRepo = tests.CreateMockUserRepo()
		ds.MockedUser = userRepo
		service = core.NewUser(ds)
		ctx = GinkgoT().Context()
	})

	Describe("NewRepository", func() {
		It("returns a rest.Persistable", func() {
			repo := service.NewRepository(ctx)
			_, ok := repo.(rest.Persistable)
			Expect(ok).To(BeTrue())
		})
	})

	Describe("Delete", func() {
		var repo rest.Persistable

		BeforeEach(func() {
			r := service.NewRepository(ctx)
			repo = r.(rest.Persistable)

			// Add a test user
			user := &model.User{
				ID:       "user-123",
				UserName: "testuser",
				IsAdmin:  false,
			}
			user.NewPassword = "password"
			Expect(userRepo.Put(user)).To(Succeed())
		})

		It("deletes the user successfully", func() {
			err := repo.Delete("user-123")
			Expect(err).NotTo(HaveOccurred())

			// Verify user is deleted
			_, err = userRepo.Get("user-123")
			Expect(err).To(Equal(model.ErrNotFound))
		})

		It("returns error when repository fails", func() {
			userRepo.Error = errors.New("database error")
			err := repo.Delete("user-123")
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("database error"))
		})
	})
})
