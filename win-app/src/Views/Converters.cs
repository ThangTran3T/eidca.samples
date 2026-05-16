// Views/Converters.cs
// Tất cả IValueConverter dùng chung toàn app — được khai báo trong Converters.xaml
// và merge vào App.xaml để sử dụng như StaticResource mọi nơi.

using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace eIDCA.WinApp.Views;

/// <summary>string rỗng → Collapsed, string có nội dung → Visible</summary>
public class EmptyToHiddenConverter : IValueConverter
{
    public object Convert(object v, Type t, object p, CultureInfo c)
        => v is string s && !string.IsNullOrWhiteSpace(s)
           ? Visibility.Visible : Visibility.Collapsed;
    public object ConvertBack(object v, Type t, object p, CultureInfo c) => Binding.DoNothing;
}

/// <summary>null → Visible (hiện placeholder), non-null → Collapsed</summary>
public class NullToVisibleConverter : IValueConverter
{
    public object Convert(object v, Type t, object p, CultureInfo c)
        => v is null ? Visibility.Visible : Visibility.Collapsed;
    public object ConvertBack(object v, Type t, object p, CultureInfo c) => Binding.DoNothing;
}

/// <summary>non-null → Visible, null → Collapsed</summary>
public class NotNullToVisibleConverter : IValueConverter
{
    public object Convert(object v, Type t, object p, CultureInfo c)
        => v is not null ? Visibility.Visible : Visibility.Collapsed;
    public object ConvertBack(object v, Type t, object p, CultureInfo c) => Binding.DoNothing;
}

/// <summary>true → Visible, false → Collapsed</summary>
public class BoolToVisibleConverter : IValueConverter
{
    public object Convert(object v, Type t, object p, CultureInfo c)
        => v is true ? Visibility.Visible : Visibility.Collapsed;
    public object ConvertBack(object v, Type t, object p, CultureInfo c) => Binding.DoNothing;
}

/// <summary>false → Visible, true → Collapsed (inverse)</summary>
public class FalseToVisibleConverter : IValueConverter
{
    public object Convert(object v, Type t, object p, CultureInfo c)
        => v is false ? Visibility.Visible : Visibility.Collapsed;
    public object ConvertBack(object v, Type t, object p, CultureInfo c) => Binding.DoNothing;
}

/// <summary>bool → !bool (dùng cho IsEnabled binding)</summary>
public class InverseBoolConverter : IValueConverter
{
    public object Convert(object v, Type t, object p, CultureInfo c)
        => v is bool b && !b;
    public object ConvertBack(object v, Type t, object p, CultureInfo c) => Binding.DoNothing;
}

/// <summary>int equality: value == ConverterParameter → true</summary>
public class IntEqualConverter : IValueConverter
{
    public object Convert(object v, Type t, object p, CultureInfo c)
        => v is int val && p is string ps && int.TryParse(ps, out var pi) && val == pi;
    public object ConvertBack(object v, Type t, object p, CultureInfo c) => Binding.DoNothing;
}

/// <summary>int >= ConverterParameter → Visible (dùng cho Stepper)</summary>
public class StepVisibilityConverter : IValueConverter
{
    public object Convert(object v, Type t, object p, CultureInfo c)
    {
        if (v is int step && p is string ps && int.TryParse(ps, out var threshold))
            return step >= threshold ? Visibility.Visible : Visibility.Collapsed;
        return Visibility.Collapsed;
    }
    public object ConvertBack(object v, Type t, object p, CultureInfo c) => Binding.DoNothing;
}

/// <summary>bool → "Mock Server" / "Live API"</summary>
public class ModeNameConverter : IValueConverter
{
    public object Convert(object v, Type t, object p, CultureInfo c)
        => v is bool b ? (b ? "Đang dùng Mock Server" : "Đang dùng Live API") : "";
    public object ConvertBack(object v, Type t, object p, CultureInfo c) => Binding.DoNothing;
}
