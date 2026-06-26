package cmd

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/spf13/cobra"
)

func newAccountCmd(app *App) *cobra.Command {
	accountCmd := &cobra.Command{
		Use:   "account",
		Short: "Account management (balance, history, pricing)",
	}

	accountCmd.AddCommand(
		newAccountBalanceCmd(app),
		newAccountHistoryCmd(app),
		newAccountPricingCmd(app),
	)

	return accountCmd
}

func newAccountBalanceCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "balance",
		Short: "Show account balance",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			result, err := app.Resource.List(cmd.Context(), "account/balance", nil)
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatAccountBalance(result)
			})
			return nil
		},
	}
}

func newAccountHistoryCmd(app *App) *cobra.Command {
	var limit int

	cmd := &cobra.Command{
		Use:   "history",
		Short: "Show usage history",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			var query url.Values
			if limit > 0 {
				query = url.Values{"limit": []string{fmt.Sprintf("%d", limit)}}
			}
			result, err := app.Resource.List(cmd.Context(), "account/history", query)
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatGenericList(result, "history")
			})
			return nil
		},
	}
	cmd.Flags().IntVar(&limit, "limit", 0, "Maximum number of entries to return")
	return cmd
}

func newAccountPricingCmd(app *App) *cobra.Command {
	return &cobra.Command{
		Use:   "pricing <slug>",
		Short: "Show model pricing",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := app.EnsureClient(); err != nil {
				return err
			}
			result, err := app.Resource.Get(cmd.Context(), "account/pricing", args[0])
			if err != nil {
				return err
			}
			app.Output.Data(result, func(payload any) string {
				return formatKeyValue(result)
			})
			return nil
		},
	}
}

func formatAccountBalance(m map[string]any) string {
	var sb strings.Builder
	if balance, ok := m["balance"]; ok {
		sb.WriteString(fmt.Sprintf("Balance: %v\n", balance))
	}
	if currency, ok := m["currency"]; ok {
		sb.WriteString(fmt.Sprintf("Currency: %v\n", currency))
	}
	if sb.Len() == 0 {
		return formatKeyValue(m)
	}
	return strings.TrimSpace(sb.String())
}
