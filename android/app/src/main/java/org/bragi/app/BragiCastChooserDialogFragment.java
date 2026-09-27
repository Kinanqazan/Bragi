package org.bragi.app;

import android.content.Context;
import android.os.Bundle;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.Window;
import android.view.WindowManager;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.AbsListView;
import android.widget.ListView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.mediarouter.app.MediaRouteChooserDialog;
import androidx.mediarouter.app.MediaRouteChooserDialogFragment;

/** Keeps AndroidX route discovery and selection while branding the Cast picker for Bragi. */
public class BragiCastChooserDialogFragment extends MediaRouteChooserDialogFragment {
    @NonNull
    @Override
    public MediaRouteChooserDialog onCreateChooserDialog(
            @NonNull Context context,
            @Nullable Bundle savedInstanceState) {
        return new MediaRouteChooserDialog(context) {
            @Override
            protected void onCreate(@Nullable Bundle state) {
                super.onCreate(state);
                setTitle(R.string.cast_picker_title);
                centerTitle(context);
                attachRouteRowStyling(context);
                addLocalPlaybackOption(context);
            }

            private ListView routeListView;

            private void centerTitle(Context context) {
                int titleId = context.getResources().getIdentifier(
                        "mr_chooser_title", "id", context.getPackageName());
                View titleView = titleId == 0 ? null : findViewById(titleId);
                if (titleView instanceof TextView) {
                    TextView title = (TextView) titleView;
                    title.setGravity(Gravity.CENTER);
                    title.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
                }
            }

            private void attachRouteRowStyling(Context context) {
                int listId = context.getResources().getIdentifier(
                        "mr_chooser_list", "id", context.getPackageName());
                View list = listId == 0 ? null : findViewById(listId);
                if (!(list instanceof ListView)) {
                    return;
                }
                routeListView = (ListView) list;
                routeListView.setOnScrollListener(new AbsListView.OnScrollListener() {
                    @Override
                    public void onScrollStateChanged(AbsListView view, int scrollState) {
                        updateVisibleRouteRows(context);
                    }

                    @Override
                    public void onScroll(
                            AbsListView view, int firstVisibleItem, int visibleItemCount,
                            int totalItemCount) {
                        updateVisibleRouteRows(context);
                    }
                });
            }

            @Override
            public void onFilterRoutes(java.util.List<androidx.mediarouter.media.MediaRouter.RouteInfo> routes) {
                super.onFilterRoutes(routes);
                if (routeListView != null) {
                    routeListView.post(() -> updateVisibleRouteRows(context));
                }
            }

            private void updateVisibleRouteRows(Context context) {
                if (routeListView == null) {
                    return;
                }
                MainActivity activity = getHostActivity();
                if (activity == null) {
                    return;
                }

                String connectedDevice = activity.getCastDeviceNameForPicker();
                if (TextUtils.isEmpty(connectedDevice)) {
                    return;
                }
                String currentTitle = activity.getCastMediaTitleForPicker();
                String subtitle = !TextUtils.isEmpty(currentTitle)
                        ? currentTitle
                        : formatRouteDescription(activity.getCastRouteDescriptionForPicker());
                int nameId = context.getResources().getIdentifier(
                        "mr_chooser_route_name", "id", context.getPackageName());
                int descriptionId = context.getResources().getIdentifier(
                        "mr_chooser_route_desc", "id", context.getPackageName());

                for (int index = 0; index < routeListView.getChildCount(); index++) {
                    View row = routeListView.getChildAt(index);
                    TextView name = row.findViewById(nameId);
                    TextView description = row.findViewById(descriptionId);
                    if (name == null || description == null) {
                        continue;
                    }

                    boolean active = connectedDevice.equalsIgnoreCase(name.getText().toString().trim());
                    row.setBackground(active
                            ? ContextCompat.getDrawable(context, R.drawable.cast_picker_connected_row)
                            : null);
                    name.setTextColor(ContextCompat.getColor(context, active
                            ? R.color.cast_picker_accent
                            : R.color.cast_picker_text_primary));
                    if (active) {
                        description.setVisibility(TextUtils.isEmpty(subtitle) ? View.GONE : View.VISIBLE);
                        if (!TextUtils.isEmpty(subtitle)
                                && !subtitle.contentEquals(description.getText())) {
                            description.setText(subtitle);
                        }
                    }
                }
            }

            private String formatRouteDescription(String description) {
                if (TextUtils.isEmpty(description)) {
                    return "";
                }
                String formatted = description.trim();
                if (formatted.length() > 1 && formatted.startsWith("(") && formatted.endsWith(")")) {
                    formatted = formatted.substring(1, formatted.length() - 1).trim();
                }
                int separator = formatted.indexOf(':');
                if (separator > 0) {
                    String prefix = formatted.substring(0, separator).trim();
                    if ("diffusion".equalsIgnoreCase(prefix) || "bragi".equalsIgnoreCase(prefix)) {
                        formatted = formatted.substring(separator + 1).trim();
                    }
                }
                return formatted;
            }

            private void addLocalPlaybackOption(Context context) {
                MainActivity activity = getHostActivity();
                if (activity == null || !activity.isCastConnectedForPicker()) {
                    return;
                }

                int listId = context.getResources().getIdentifier(
                        "mr_chooser_list", "id", context.getPackageName());
                View routeList = listId == 0 ? null : findViewById(listId);
                if (routeList == null || !(routeList.getParent() instanceof LinearLayout)) {
                    return;
                }

                LinearLayout parent = (LinearLayout) routeList.getParent();
                TextView localOption = new TextView(context);
                localOption.setText(R.string.cast_picker_play_on_phone);
                localOption.setTextColor(ContextCompat.getColor(
                        context, R.color.cast_picker_text_primary));
                localOption.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
                localOption.setGravity(Gravity.CENTER_VERTICAL);
                localOption.setMinHeight(dp(context, 69));
                localOption.setPadding(dp(context, 24), dp(context, 10), dp(context, 24), dp(context, 10));
                localOption.setCompoundDrawablePadding(dp(context, 24));
                localOption.setCompoundDrawablesRelativeWithIntrinsicBounds(
                        ContextCompat.getDrawable(context, R.drawable.ic_cast_local_device), null, null, null);
                localOption.setBackground(selectableBackground(context));
                localOption.setFocusable(true);
                localOption.setClickable(true);
                localOption.setOnClickListener(view -> {
                    activity.endCastSessionFromPicker();
                    dismiss();
                });

                View divider = new View(context);
                divider.setBackgroundColor(ContextCompat.getColor(
                        context, R.color.cast_picker_outline));
                LinearLayout.LayoutParams dividerParams = new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        dp(context, 1));
                dividerParams.setMarginStart(dp(context, 24));
                dividerParams.setMarginEnd(dp(context, 24));
                LinearLayout.LayoutParams optionParams = new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT);
                int insertAt = parent.indexOfChild(routeList) + 1;
                parent.addView(divider, insertAt, dividerParams);
                parent.addView(localOption, insertAt + 1, optionParams);
            }

            private Drawable selectableBackground(Context context) {
                TypedValue value = new TypedValue();
                if (context.getTheme().resolveAttribute(
                        android.R.attr.selectableItemBackground, value, true)) {
                    return ContextCompat.getDrawable(context, value.resourceId);
                }
                GradientDrawable fallback = new GradientDrawable();
                fallback.setColor(ContextCompat.getColor(context, R.color.cast_picker_surface));
                fallback.setCornerRadius(dp(context, 12));
                return fallback;
            }

            private int dp(Context context, int value) {
                return Math.round(value * context.getResources().getDisplayMetrics().density);
            }

            @Override
            public void dismiss() {
                if (routeListView != null) {
                    routeListView.setOnScrollListener(null);
                }
                super.dismiss();
            }
        };
    }

    @Override
    public void onStart() {
        super.onStart();
        Window window = getDialog() == null ? null : getDialog().getWindow();
        if (window == null) {
            return;
        }

        float density = getResources().getDisplayMetrics().density;
        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int horizontalMargin = Math.round(48 * density);
        int preferredWidth = Math.round(300 * density);
        int width = Math.min(preferredWidth, Math.max(0, screenWidth - horizontalMargin));
        window.setLayout(width, WindowManager.LayoutParams.WRAP_CONTENT);
        window.setGravity(Gravity.CENTER);
    }

    @Nullable
    private MainActivity getHostActivity() {
        return getActivity() instanceof MainActivity ? (MainActivity) getActivity() : null;
    }
}
