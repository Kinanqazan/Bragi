-- +goose Up
alter table artist add column name_override varchar(255) default '' not null;

-- +goose Down
alter table artist drop column name_override;
