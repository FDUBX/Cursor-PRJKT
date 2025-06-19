# Commande ffmpeg pour le transcodage avec LUT
ffmpeg_cmd = [
    'ffmpeg',
    '-i', input_path,
    '-vf', f'lut3d={self.lut_path}',
    '-c:v', 'libx265',
    '-preset', 'medium',
    '-b:v', '7M',  # Débit cible de 7 Mb/s
    output_path
] 