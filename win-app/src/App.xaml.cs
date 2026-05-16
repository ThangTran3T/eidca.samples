// App.xaml.cs
using eIDCA.WinApp.Core;
using eIDCA.WinApp.Services;
using eIDCA.WinApp.ViewModels;
using eIDCA.WinApp.Views;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Windows;

namespace eIDCA.WinApp;

public partial class App : Application
{
    private ServiceProvider? _services;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        try
        {
            // 1. Load config
            var configBuilder = new ConfigurationBuilder()
                .SetBasePath(AppContext.BaseDirectory)
                .AddJsonFile("appsettings.json", optional: false)
                .AddJsonFile("appsettings.Development.json", optional: true);

            var configuration = configBuilder.Build();
            var appConfig     = AppConfig.Load(configuration);

            // 2. DI container
            var services = new ServiceCollection();
            services.AddSingleton(appConfig);
            services.AddSingleton<EidcaApiService>();
            services.AddSingleton<MainWindowViewModel>();

            _services = services.BuildServiceProvider();

            // 3. Create + show MainWindow với DataContext
            var vm         = _services.GetRequiredService<MainWindowViewModel>();
            var mainWindow = new MainWindow();
            mainWindow.DataContext = vm;
            MainWindow = mainWindow;   // Đặt làm MainWindow của Application
            mainWindow.Show();
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"Lỗi khởi động:\n\n{ex.GetType().Name}: {ex.Message}\n\n{ex.StackTrace}",
                "eIDCA — Startup Error",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
            Shutdown(1);
        }
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _services?.Dispose();
        base.OnExit(e);
    }
}
