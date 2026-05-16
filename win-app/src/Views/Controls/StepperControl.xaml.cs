// Views/Controls/StepperControl.xaml.cs
// Visual state updater cho Stepper — 3 bước.
// Dùng named elements trực tiếp, không cast Children[].

using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace eIDCA.WinApp.Views.Controls;

public partial class StepperControl : UserControl
{
    // ── Dependency Property ───────────────────────────────────────────────────
    public static readonly DependencyProperty CurrentStepProperty =
        DependencyProperty.Register(
            nameof(CurrentStep), typeof(int), typeof(StepperControl),
            new PropertyMetadata(0, OnCurrentStepChanged));

    public int CurrentStep
    {
        get => (int)GetValue(CurrentStepProperty);
        set => SetValue(CurrentStepProperty, value);
    }

    public static readonly DependencyProperty Step0LabelProperty =
        DependencyProperty.Register(nameof(Step0Label), typeof(string), typeof(StepperControl),
            new PropertyMetadata("Bước 1", (d, _) => ((StepperControl)d).RefreshLabels()));

    public static readonly DependencyProperty Step1LabelProperty =
        DependencyProperty.Register(nameof(Step1Label), typeof(string), typeof(StepperControl),
            new PropertyMetadata("Bước 2", (d, _) => ((StepperControl)d).RefreshLabels()));

    public static readonly DependencyProperty Step2LabelProperty =
        DependencyProperty.Register(nameof(Step2Label), typeof(string), typeof(StepperControl),
            new PropertyMetadata("Bước 3", (d, _) => ((StepperControl)d).RefreshLabels()));

    public string Step0Label { get => (string)GetValue(Step0LabelProperty); set => SetValue(Step0LabelProperty, value); }
    public string Step1Label { get => (string)GetValue(Step1LabelProperty); set => SetValue(Step1LabelProperty, value); }
    public string Step2Label { get => (string)GetValue(Step2LabelProperty); set => SetValue(Step2LabelProperty, value); }

    // ── Brushes ───────────────────────────────────────────────────────────────
    private static readonly SolidColorBrush ActiveBrush  = new(Color.FromRgb(0x63, 0x66, 0xf1)); // #6366f1
    private static readonly SolidColorBrush DoneBrush    = new(Color.FromRgb(0x10, 0xb9, 0x81)); // #10b981
    private static readonly SolidColorBrush PendingBrush = new(Color.FromRgb(0x2a, 0x2a, 0x4a)); // #2a2a4a
    private static readonly SolidColorBrush BorderActive  = ActiveBrush;
    private static readonly SolidColorBrush BorderPending = new(Color.FromRgb(0x2a, 0x2a, 0x4a));

    public StepperControl()
    {
        InitializeComponent();
        Loaded += (_, _) => { RefreshLabels(); UpdateVisual(CurrentStep); };
    }

    private static void OnCurrentStepChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        => ((StepperControl)d).UpdateVisual((int)e.NewValue);

    private void RefreshLabels()
    {
        if (Step0Label_ is null) return;
        Step0Label_.Text = Step0Label;
        Step1Label_.Text = Step1Label;
        Step2Label_.Text = Step2Label;
    }

    private void UpdateVisual(int current)
    {
        if (Step0 is null) return;   // XAML chưa load

        // Lấy Border circle từ Children[0] của mỗi StackPanel
        var circle0 = (Border)Step0.Children[0];
        var circle1 = (Border)Step1.Children[0];
        var circle2 = (Border)Step2.Children[0];

        // Step 0
        circle0.Background   = current == 0 ? ActiveBrush : (current > 0 ? DoneBrush : PendingBrush);
        circle0.BorderBrush  = current >= 0 ? BorderActive : BorderPending;

        // Step 1
        circle1.Background   = current == 1 ? ActiveBrush : (current > 1 ? DoneBrush : PendingBrush);
        circle1.BorderBrush  = current >= 1 ? BorderActive : BorderPending;

        // Step 2
        circle2.Background   = current == 2 ? ActiveBrush : (current > 2 ? DoneBrush : PendingBrush);
        circle2.BorderBrush  = current >= 2 ? BorderActive : BorderPending;

        // Connector lines
        Line01.Background = current >= 1 ? DoneBrush : PendingBrush;
        Line12.Background = current >= 2 ? DoneBrush : PendingBrush;

        // Label colors
        SetLabelColor(Step0Label_, current, 0);
        SetLabelColor(Step1Label_, current, 1);
        SetLabelColor(Step2Label_, current, 2);
    }

    private static void SetLabelColor(TextBlock lbl, int current, int step)
    {
        lbl.Foreground = current == step ? ActiveBrush
                       : current > step  ? DoneBrush
                       : new SolidColorBrush(Color.FromRgb(0x64, 0x74, 0x8b));
    }
}
