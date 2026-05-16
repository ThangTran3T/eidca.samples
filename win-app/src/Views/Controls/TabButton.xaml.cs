// Views/Controls/TabButton.xaml.cs
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace eIDCA.WinApp.Views.Controls;

public partial class TabButton : UserControl
{
    public static readonly DependencyProperty TextProperty =
        DependencyProperty.Register(nameof(Text), typeof(string), typeof(TabButton), new PropertyMetadata(""));
    public static readonly DependencyProperty IndexProperty =
        DependencyProperty.Register(nameof(Index), typeof(int), typeof(TabButton), new PropertyMetadata(0));
    public static readonly DependencyProperty CommandProperty =
        DependencyProperty.Register(nameof(Command), typeof(ICommand), typeof(TabButton), new PropertyMetadata(null));
    public static readonly DependencyProperty IsSelectedProperty =
        DependencyProperty.Register(nameof(IsSelected), typeof(bool), typeof(TabButton), new PropertyMetadata(false));

    public string   Text       { get => (string)GetValue(TextProperty);    set => SetValue(TextProperty, value); }
    public int      Index      { get => (int)GetValue(IndexProperty);      set => SetValue(IndexProperty, value); }
    public ICommand Command    { get => (ICommand)GetValue(CommandProperty); set => SetValue(CommandProperty, value); }
    public bool     IsSelected { get => (bool)GetValue(IsSelectedProperty); set => SetValue(IsSelectedProperty, value); }

    public TabButton()
    {
        InitializeComponent();
        // Không set DataContext = this — dùng ElementName=Root_ trong XAML
    }
}
