@echo off
REM Script pour envoyer un paquet Wake-on-LAN sans dépendance externe

REM Vérification et création de la règle de pare-feu
echo Vérification des règles de pare-feu...
powershell -Command "if (-not (Get-NetFirewallRule -DisplayName 'WakeOnLAN' -ErrorAction SilentlyContinue)) { New-NetFirewallRule -DisplayName 'WakeOnLAN' -Direction Outbound -Action Allow -Protocol UDP -LocalPort 9 -RemotePort 9 -Program 'System' -Description 'Autorise les paquets Wake-on-LAN' }"

REM Adresse MAC de la machine à réveiller
set MAC=80:1f:12:7b:75:b9

REM Adresses de destination
set TARGET_IP=10.130.34.103
set BROADCAST_34=10.130.34.255
set BROADCAST_35=10.130.35.255

echo Vérification de la connectivité réseau...
powershell -Command "$ping = Test-NetConnection -ComputerName %TARGET_IP% -Port 9 -WarningAction SilentlyContinue; Write-Host ('Ping vers %TARGET_IP%: ' + $ping.TcpTestSucceeded)"

echo.
echo Envoi du paquet Wake-on-LAN...
powershell -Command "$mac = '%MAC%' -replace ':', ''; $mac = [byte[]]::new(6); $mac[0] = 0x80; $mac[1] = 0x1f; $mac[2] = 0x12; $mac[3] = 0x7b; $mac[4] = 0x75; $mac[5] = 0xb9; $packet = [byte[]]::new(102); for ($i = 0; $i -lt 6; $i++) { $packet[$i] = 0xFF }; for ($i = 1; $i -le 16; $i++) { for ($j = 0; $j -lt 6; $j++) { $packet[$i * 6 + $j] = $mac[$j] } }; $udp = New-Object System.Net.Sockets.UdpClient; $udp.Client.SetSocketOption([System.Net.Sockets.SocketOptionLevel]::Socket, [System.Net.Sockets.SocketOptionName]::Broadcast, $true); Write-Host 'Envoi à %TARGET_IP%...'; $endpointTarget = [System.Net.IPEndPoint]::new([System.Net.IPAddress]::Parse('%TARGET_IP%'), 9); $bytesSentTarget = $udp.Send($packet, $packet.Length, $endpointTarget); Write-Host ('Paquet envoyé à %TARGET_IP%: ' + $bytesSentTarget + ' octets'); Write-Host 'Envoi à %BROADCAST_34%...'; $endpoint34 = [System.Net.IPEndPoint]::new([System.Net.IPAddress]::Parse('%BROADCAST_34%'), 9); $bytesSent34 = $udp.Send($packet, $packet.Length, $endpoint34); Write-Host ('Paquet envoyé à %BROADCAST_34%: ' + $bytesSent34 + ' octets'); Write-Host 'Envoi à %BROADCAST_35%...'; $endpoint35 = [System.Net.IPEndPoint]::new([System.Net.IPAddress]::Parse('%BROADCAST_35%'), 9); $bytesSent35 = $udp.Send($packet, $packet.Length, $endpoint35); Write-Host ('Paquet envoyé à %BROADCAST_35%: ' + $bytesSent35 + ' octets'); $udp.Close()"

echo.
echo Résumé de l'envoi:
echo - Paquet envoyé à l'adresse IP spécifique %TARGET_IP% sur le port 9
echo - Paquet envoyé à l'adresse de broadcast %BROADCAST_34% sur le port 9
echo - Paquet envoyé à l'adresse de broadcast %BROADCAST_35% sur le port 9
echo - Taille du paquet: 102 octets
echo - Adresse MAC cible: %MAC%
echo.
echo Pour capturer le trafic dans Wireshark, utilisez le filtre:
echo (ip.dst == %TARGET_IP% or ip.dst == %BROADCAST_34% or ip.dst == %BROADCAST_35%) and udp.port == 9
echo.
echo Pour supprimer la règle de pare-feu plus tard, utilisez:
echo powershell -Command "Remove-NetFirewallRule -DisplayName 'WakeOnLAN'"
echo.
pause 