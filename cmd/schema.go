package cmd

import (
	"github.com/spf13/cobra"
)

func newSchemaCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "schema <slug>",
		Short: "Display model parameter schema",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return schemaExec(cmd, app, args[0])
		},
	}
}

func schemaExec(cmd *cobra.Command, app *App, slug string) error {
	if err := app.EnsureClient(); err != nil {
		return err
	}

	ctx := cmd.Context()

	// Resolve alias
	cwd, _ := getCwd()
	cfg, err := app.Config.Load(cwd)
	if err == nil {
		slug = app.Config.ResolveAlias(cfg, slug)
	}

	sp := app.Output.Spinner("Fetching schema...")
	sp.Start()
	schema, err := app.Schema.Fetch(ctx, slug)
	sp.Stop()
	if err != nil {
		return err
	}

	app.Output.Data(
		schema,
		func(payload any) string {
			return app.Schema.ToTable(schema)
		},
	)
	return nil
}
