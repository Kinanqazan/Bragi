package configtest

import "github.com/kinanqaz/bragi/conf"

// TODO Remove this redirection and call SnapshotConfig directly from tests
func SetupConfig() func() {
	return conf.SnapshotConfig()
}
