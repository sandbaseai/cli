package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

// Version is set at build time via ldflags.
var Version = "dev"

// NewRootCmd creates and returns the root cobra.Command for the sandbase CLI.
// It implements a two-phase lifecycle:
// 1. Construction: creates App shell and binds flag pointers
// 2. PreRun: app.init() constructs all services once flags are parsed
func NewRootCmd() *cobra.Command {
	app := &App{}

	root := &cobra.Command{
		Use:           "sandbase",
		Short:         "SandBase AI platform CLI",
		SilenceErrors: true,
		SilenceUsage:  true,
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			// Check for --version flag
			if v, _ := cmd.Flags().GetBool("version"); v {
				fmt.Fprintln(cmd.OutOrStdout(), "sandbase "+Version)
				return nil
			}
			return app.init()
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			// If --version was passed, we already printed it in PreRun
			if v, _ := cmd.Flags().GetBool("version"); v {
				return nil
			}
			return cmd.Help()
		},
	}

	// Global flags
	root.PersistentFlags().BoolVar(&app.Flags.JSON, "json", false, "Force JSON output")
	root.PersistentFlags().BoolVar(&app.Flags.Verbose, "verbose", false, "Output full HTTP diagnostics to stderr")
	root.PersistentFlags().IntVar(&app.Flags.Timeout, "timeout", 300, "Single API call timeout in seconds")
	root.PersistentFlags().Bool("version", false, "Print version information")

	// Wire up sub-commands
	root.AddCommand(
		newAuthCmd(app),
		newModelsCmd(app),
		newSchemaCmd(app),
		newRunCmd(app),
		newChatCmd(app),
		newStatusCmd(app),
		newAgentCmd(app),
		newEnvironmentCmd(app),
		newSessionCmd(app),
		newSkillCmd(app),
		newSandboxCmd(app),
		newMcpCmd(app),
		newUploadCmd(app),
		newDownloadCmd(app),
		newAccountCmd(app),
		newOpenCmd(app),
		newConfigCmd(app),
		newInitCmd(app),
	)

	return root
}
