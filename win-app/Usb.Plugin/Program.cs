using System.Text.Json;
using Usb.Plugin.Probing;

namespace Usb.Plugin;

internal static class Program
{
    public static async Task<int> Main(string[] args)
    {
        Options options = Options.Parse(args);
        if (options.Module is not null)
        {
            ModuleScan scan = Worker.Scan(options);
            Console.Write(JsonSerializer.Serialize(scan));
            return scan.Errors.Count == 0 ? 0 : 1;
        }
        ProbeReport report = await new Probe().RunAsync(options);
        string output = Path.GetFullPath(options.Output ?? Path.Combine(AppContext.BaseDirectory, "reports", $"usb-token-{DateTimeOffset.UtcNow:yyyyMMdd-HHmmss}.json"));
        Directory.CreateDirectory(Path.GetDirectoryName(output)!);
        await File.WriteAllTextAsync(output, JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }));
        Console.WriteLine(output);
        return 0;
    }
}
